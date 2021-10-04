import earcut from 'earcut';


export function create(options) {
    const _options = {
        layerId: '',
        opacity: 0.5,
        minValue: Infinity,
        maxValue: -Infinity,
        p: 3,
        framebufferFactor: 0.3,
        points: [],
        roi: [],
        valueToColor: `
            vec3 valueToColor(float value) {
                return vec3(max((value-0.5)*2.0, 0.0), 1.0 - 2.0*abs(value - 0.5), max((0.5-value)*2.0, 0.0));
            }
        `
    }

    if (typeof options === 'object'){
        for(let option in options) {
            _options[option] = options[option];
        }  
    }

    // Having a framebufferFactor < 1 and a texture that don't cover the entire map results in visual artifacts, so we prevent this situation
    const textureCoverSameAreaAsROI = _options['framebufferFactor'] == 1;

    return {
        id: _options.layerId,
        type: 'custom',
        onAdd: function (map, gl) {
            if (!gl.getExtension('OES_texture_float') || !gl.getExtension('WEBGL_color_buffer_float') || !gl.getExtension('EXT_float_blend')) {
                throw("WebGL extension not supported");
            }

            this.canvas = map._canvas;
    
            const vertexSource = `
                precision highp float;
                attribute vec2 a_Position;
                uniform mat4 u_Matrix;
                void main() {
                    gl_Position = u_Matrix * vec4(a_Position, 0.0, 1.0);
                }
            `;
            const fragmentSource = `
                precision highp float;

                ${_options['valueToColor']}

                uniform sampler2D u_ComputationTexture;
                uniform vec2 u_ScreenSize;
                uniform float u_Opacity;

                void main(void) {
                    vec4 data = texture2D(u_ComputationTexture, vec2(gl_FragCoord.x/u_ScreenSize.x, gl_FragCoord.y/u_ScreenSize.y));
                    float u = data.x/data.y;
                    gl_FragColor.rgb = valueToColor(u);
                    gl_FragColor.a = u_Opacity;
                }
            `;
            const computationVertexSource = `
                precision highp float;
                uniform mat4 u_Matrix;
                uniform vec2 xi;
                varying vec2 xiNormalized;
                attribute vec2 a_Position;
                void main() {
                    vec4 xiProjected = u_Matrix * vec4(xi, 0.0, 1.0);
                    xiNormalized = vec2(xiProjected.x / xiProjected.w, xiProjected.y / xiProjected.w);
                    gl_Position = u_Matrix * vec4(a_Position, 0.0, 1.0);
                }
            `;
            const computationFragmentSource = `
                precision highp float;
                uniform float ui;
                varying vec2 xiNormalized;
                uniform float p;
                uniform vec2 u_FramebufferSize;
                void main() {
                    vec2 x = vec2(gl_FragCoord.x/u_FramebufferSize.x, gl_FragCoord.y/u_FramebufferSize.y);
                    vec2 xi = vec2((xiNormalized.x + 1.)/2., (xiNormalized.y + 1.)/2.);
                    float dist = distance(x, xi);
                    float wi = 1.0/pow(dist, p);
                    gl_FragColor = vec4(ui*wi, wi, 0.0, 1.0);
                }
            `;
            
            const computationVertexShader = createVertexShader(gl, computationVertexSource);
            const computationFragmentShader = createFragmentShader(gl, computationFragmentSource);

            this.computationProgram = createProgram(gl, computationVertexShader, computationFragmentShader);
            this.aPositionComputation = gl.getAttribLocation(this.computationProgram, 'a_Position');
            this.uMatrixComputation = gl.getUniformLocation(this.computationProgram, 'u_Matrix');
            this.uUi = gl.getUniformLocation(this.computationProgram, "ui");
            this.uXi = gl.getUniformLocation(this.computationProgram, "xi");
            this.uP = gl.getUniformLocation(this.computationProgram, "p");
            this.uFramebufferSize = gl.getUniformLocation(this.computationProgram, "u_FramebufferSize");
            if (this.aPositionComputation < 0 || !this.uMatrixComputation || !this.uUi || !this.uXi || !this.uP || !this.uFramebufferSize) {
                throw("WebGL error: Failed to get the storage location of computation variable");
            }
            
            const drawingVertexShader = createVertexShader(gl, vertexSource);
            const drawingFragmentShader = createFragmentShader(gl, fragmentSource);

            this.drawProgram = createProgram(gl, drawingVertexShader, drawingFragmentShader);
            this.aPositionDraw = gl.getAttribLocation(this.drawProgram, 'a_Position');
            this.uMatrixDraw = gl.getUniformLocation(this.drawProgram, 'u_Matrix');
            this.uComputationTexture = gl.getUniformLocation(this.drawProgram, 'u_ComputationTexture');
            this.uScreenSizeDraw = gl.getUniformLocation(this.drawProgram, 'u_ScreenSize');
            this.uOpacity = gl.getUniformLocation(this.drawProgram, 'u_Opacity');
            if (this.aPositionDraw < 0 || !this.uMatrixDraw || !this.uComputationTexture || !this.uScreenSizeDraw || !this.uOpacity) {
                throw("WebGL error: Failed to get the storage location of drawing variable");
            }

            const drawingVertices = [];
            if (_options['roi'].length == 0) {
                drawingVertices.push(-1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0);
            } else {
                _options['roi'].forEach(roi => {
                    const coordinates = mapboxgl.MercatorCoordinate.fromLngLat(roi);
                    drawingVertices.push(coordinates.x, coordinates.y);
                });
            }
            
            this.drawingVerticesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.drawingVerticesBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(drawingVertices), gl.STATIC_DRAW);

            const computationVertices = textureCoverSameAreaAsROI ? drawingVertices : [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
            this.computationVerticesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.computationVerticesBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(computationVertices), gl.STATIC_DRAW);

            const indices = earcut(drawingVertices);
            this.indicesBuffer = gl.createBuffer();
            this.indicesBuffer.indicesNumber = indices.length;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);
    
            this.framebufferWidth = Math.ceil(this.canvas.width * _options.framebufferFactor);
            this.framebufferHeight = Math.ceil(this.canvas.height * _options.framebufferFactor);
    
            this.computationTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.framebufferWidth, this.framebufferHeight, 0, gl.RGBA, gl.FLOAT, null);
            
            this.computationFramebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.computationFramebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.computationTexture, 0);
    
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
            this.points = [];
            let minValue = Infinity;
            let maxValue = -Infinity;
            _options.points.forEach(rawPoint => {
                const mercatorCoordinates = mapboxgl.MercatorCoordinate.fromLngLat(rawPoint);
                this.points.push([mercatorCoordinates.x, mercatorCoordinates.y, rawPoint.val]);
                if (rawPoint.val < minValue) {
                    minValue = rawPoint.val;
                }
                if (rawPoint.val > maxValue) {
                    maxValue = rawPoint.val;
                }
            });
            minValue = minValue < _options.minValue ? minValue : _options.minValue;
            maxValue = maxValue > _options.maxValue ? maxValue : _options.maxValue;
            this.points.forEach(point => {
                point[2] = (point[2] - minValue) / (maxValue - minValue);
            });

            this.resizeFramebuffer = () => {
                this.framebufferWidth = Math.ceil(this.canvas.width * _options.framebufferFactor);
                this.framebufferHeight = Math.ceil(this.canvas.height * _options.framebufferFactor);
    
                gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.framebufferWidth, this.framebufferHeight, 0, gl.RGBA, gl.FLOAT, null);
            }
            map.on('resize', this.resizeFramebuffer);
        },

        onRemove: function (map, gl) {
            map.off('resize', this.resizeFramebuffer);

            gl.deleteTexture(this.computationTexture);
            gl.deleteBuffer(this.drawingVerticesBuffer);
            gl.deleteBuffer(this.computationVerticesBuffer);
            gl.deleteBuffer(this.indicesBuffer);
            gl.deleteFramebuffer(this.computationFramebuffer);
        },
    
        prerender: function (gl, matrix) {
            gl.disable(gl.DEPTH_TEST);
            
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE);
            
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
    
            gl.useProgram(this.computationProgram);
            gl.uniformMatrix4fv(this.uMatrixComputation, false, matrix);
    
            gl.uniform1f(this.uP, _options.p);
            gl.uniform2f(this.uFramebufferSize, this.framebufferWidth, this.framebufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.computationFramebuffer);
            gl.viewport(0, 0, this.framebufferWidth, this.framebufferHeight);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);

            for(let i=0; i < this.points.length; i++) {
                const point = this.points[i];
                gl.uniform1f(this.uUi, point[2]);
                gl.uniform2f(this.uXi, point[0], point[1]);
    
                gl.bindBuffer(gl.ARRAY_BUFFER, this.computationVerticesBuffer);
                gl.enableVertexAttribArray(this.aPositionComputation);
                gl.vertexAttribPointer(this.aPositionComputation, 2, gl.FLOAT, false, 0, 0);
                if (textureCoverSameAreaAsROI) {
                    gl.drawElements(gl.TRIANGLES, this.indicesBuffer.indicesNumber, gl.UNSIGNED_BYTE, 0);
                } else {
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }
            }
    
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        },
            
        render: function (gl, matrix) {
            gl.useProgram(this.drawProgram);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.drawingVerticesBuffer);
            gl.enableVertexAttribArray(this.aPositionDraw);
            gl.vertexAttribPointer(this.aPositionDraw, 2, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(this.uMatrixDraw, false, matrix);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
            gl.uniform1i(this.uComputationTexture, 0);
            gl.uniform2f(this.uScreenSizeDraw, this.canvas.width, this.canvas.height);
            gl.uniform1f(this.uOpacity, _options.opacity);
    
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
            gl.drawElements(gl.TRIANGLES, this.indicesBuffer.indicesNumber, gl.UNSIGNED_BYTE, 0);
        },
    };

    function createVertexShader(gl, source) {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        return compileShader(gl, vertexShader, source);
    }
    
    function createFragmentShader(gl, source) {
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        return compileShader(gl, fragmentShader, source);
    }
    
    function compileShader(gl, shader, source) {
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw(gl.getShaderInfoLog(shader));
        }
        return shader;
    }
    
    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw(gl.getProgramInfoLog(program));
        }
        return program;
    }
}