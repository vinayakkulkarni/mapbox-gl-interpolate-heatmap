import earcut from 'earcut';
import mapboxgl, { CustomLayerInterface } from 'mapbox-gl';
import type { Options } from '../types';

class MapboxInterpolateHeatmapLayer implements CustomLayerInterface {
  framebufferFactor = 0.3;
  id = '';
  maxValue = -Infinity;
  minValue = Infinity;
  opacity = 0.5;
  p = 3;
  data: { lat: number; lon: number; val: number }[] = [];
  aoi?: { lat: number; lon: number }[] = [];
  textureCoverSameAreaAsROI: boolean;
  valueToColor?: string = `
  vec3 valueToColor(float value) {
      return vec3(max((value-0.5)*2.0, 0.0), 1.0 - 2.0*abs(value - 0.5), max((0.5-value)*2.0, 0.0));
  }
`;
  points: number[][] = [];
  // Custom Props
  aPositionComputation?: number;
  aPositionDraw?: number;
  canvas?: HTMLCanvasElement;
  computationFramebuffer: WebGLFramebuffer | null = null;
  computationProgram: WebGLProgram | null = null;
  computationTexture: WebGLTexture | null = null;
  computationVerticesBuffer: WebGLBuffer | null = null;
  drawingVerticesBuffer: WebGLBuffer | null = null;
  drawProgram: WebGLProgram | null = null;
  framebufferHeight?: number;
  framebufferWidth?: number;
  indicesBuffer: WebGLBuffer | null = null;
  indicesNumber: number | null = null;
  renderingMode: '2d' | '3d' = '2d';
  resizeFramebuffer?: () => void;
  type: 'custom' = 'custom';
  uComputationTexture: WebGLUniformLocation | null = null;
  uFramebufferSize: WebGLUniformLocation | null = null;
  uMatrixComputation: WebGLUniformLocation | null = null;
  uMatrixDraw: WebGLUniformLocation | null = null;
  uOpacity: WebGLUniformLocation | null = null;
  uP: WebGLUniformLocation | null = null;
  uScreenSizeDraw: WebGLUniformLocation | null = null;
  uUi: WebGLUniformLocation | null = null;
  uXi: WebGLUniformLocation | null = null;

  constructor(options: Options) {
    this.id = options.id || '';
    this.data = options.data || [];
    this.aoi = options.aoi || [];
    this.valueToColor =
      options.valueToColor ||
      `
      vec3 valueToColor(float value) {
          return vec3(max((value-0.5)*2.0, 0.0), 1.0 - 2.0*abs(value - 0.5), max((0.5-value)*2.0, 0.0));
      }
  `;
    this.opacity = options.opacity || 0.5;
    this.minValue = options.minValue || Infinity;
    this.maxValue = options.maxValue || -Infinity;
    this.p = options.p || 3;
    this.framebufferFactor = options.framebufferFactor || 0.3;
    // Having a framebufferFactor < 1 and a texture that don't cover the entire map results in visual artifacts, so we prevent this situation
    this.textureCoverSameAreaAsROI = this.framebufferFactor === 1;
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    if (
      !gl.getExtension('OES_texture_float') ||
      !gl.getExtension('WEBGL_color_buffer_float') ||
      !gl.getExtension('EXT_float_blend')
    ) {
      throw 'WebGL extension not supported';
    }
    this.canvas = map.getCanvas();
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
              ${this.valueToColor}
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
    const computationVertexShader = createVertexShader(
      gl,
      computationVertexSource,
    );
    if (!computationVertexShader)
      throw new Error('error: computation vertex shader not created');
    const computationFragmentShader = createFragmentShader(
      gl,
      computationFragmentSource,
    );
    if (!computationFragmentShader)
      throw new Error('error: computation fragment shader not created');
    this.computationProgram = createProgram(
      gl,
      computationVertexShader,
      computationFragmentShader,
    );
    if (!this.computationProgram)
      throw new Error('error: computation fragment shader not created');
    this.aPositionComputation = gl.getAttribLocation(
      this.computationProgram,
      'a_Position',
    );
    this.uMatrixComputation = gl.getUniformLocation(
      this.computationProgram,
      'u_Matrix',
    );
    this.uUi = gl.getUniformLocation(this.computationProgram, 'ui');
    this.uXi = gl.getUniformLocation(this.computationProgram, 'xi');
    this.uP = gl.getUniformLocation(this.computationProgram, 'p');
    this.uFramebufferSize = gl.getUniformLocation(
      this.computationProgram,
      'u_FramebufferSize',
    );
    if (
      this.aPositionComputation < 0 ||
      !this.uMatrixComputation ||
      !this.uUi ||
      !this.uXi ||
      !this.uP ||
      !this.uFramebufferSize
    ) {
      throw 'WebGL error: Failed to get the storage location of computation variable';
    }
    const drawingVertexShader = createVertexShader(gl, vertexSource);
    if (!drawingVertexShader)
      throw new Error('error: drawing vertex shader not created');
    const drawingFragmentShader = createFragmentShader(gl, fragmentSource);
    if (!drawingFragmentShader)
      throw new Error('error: drawing fragment shader not created');
    this.drawProgram = createProgram(
      gl,
      drawingVertexShader,
      drawingFragmentShader,
    );
    if (!this.drawProgram)
      throw new Error('error: drawing program not created');
    this.aPositionDraw = gl.getAttribLocation(this.drawProgram, 'a_Position');
    this.uMatrixDraw = gl.getUniformLocation(this.drawProgram, 'u_Matrix');
    this.uComputationTexture = gl.getUniformLocation(
      this.drawProgram,
      'u_ComputationTexture',
    );
    this.uScreenSizeDraw = gl.getUniformLocation(
      this.drawProgram,
      'u_ScreenSize',
    );
    this.uOpacity = gl.getUniformLocation(this.drawProgram, 'u_Opacity');
    if (
      this.aPositionDraw < 0 ||
      !this.uMatrixDraw ||
      !this.uComputationTexture ||
      !this.uScreenSizeDraw ||
      !this.uOpacity
    ) {
      throw 'WebGL error: Failed to get the storage location of drawing variable';
    }
    const drawingVertices = [];
    if (this.aoi?.length === 0) {
      drawingVertices.push(-1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0);
    } else {
      this.aoi?.forEach((aoi) => {
        const coordinates = mapboxgl.MercatorCoordinate.fromLngLat(aoi);
        drawingVertices.push(coordinates.x, coordinates.y);
      });
    }
    this.drawingVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.drawingVerticesBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(drawingVertices),
      gl.STATIC_DRAW,
    );
    const computationVertices = this.textureCoverSameAreaAsROI
      ? drawingVertices
      : [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
    this.computationVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.computationVerticesBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(computationVertices),
      gl.STATIC_DRAW,
    );
    const indices = earcut(drawingVertices);
    this.indicesBuffer = gl.createBuffer();
    if (!this.indicesBuffer)
      throw new Error('error: indices buffer not created');
    this.indicesNumber = indices.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint8Array(indices),
      gl.STATIC_DRAW,
    );
    this.framebufferWidth = Math.ceil(
      this.canvas.width * this.framebufferFactor,
    );
    this.framebufferHeight = Math.ceil(
      this.canvas.height * this.framebufferFactor,
    );
    this.computationTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.framebufferWidth,
      this.framebufferHeight,
      0,
      gl.RGBA,
      gl.FLOAT,
      null,
    );
    this.computationFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.computationFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.computationTexture,
      0,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.points = [];
    let minValue = Infinity;
    let maxValue = -Infinity;
    this.data.forEach((rawPoint) => {
      const mercatorCoordinates =
        mapboxgl.MercatorCoordinate.fromLngLat(rawPoint);
      this.points.push([
        mercatorCoordinates.x,
        mercatorCoordinates.y,
        rawPoint.val,
      ]);
      if (rawPoint.val < minValue) {
        minValue = rawPoint.val;
      }
      if (rawPoint.val > maxValue) {
        maxValue = rawPoint.val;
      }
    });
    minValue = minValue < this.minValue ? minValue : this.minValue;
    maxValue = maxValue > this.maxValue ? maxValue : this.maxValue;
    this.points.forEach((point) => {
      point[2] = (point[2] - minValue) / (maxValue - minValue);
    });
    this.resizeFramebuffer = () => {
      if (!this.canvas || !this.canvas.width || !this.canvas.height)
        throw new Error('error: required canvas `width` & `height`');
      this.framebufferWidth = Math.ceil(
        this.canvas.width * this.framebufferFactor,
      );
      this.framebufferHeight = Math.ceil(
        this.canvas.height * this.framebufferFactor,
      );
      gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.framebufferWidth,
        this.framebufferHeight,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );
    };
    map.on('resize', this.resizeFramebuffer);
  }
  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    if (!this.resizeFramebuffer)
      throw new Error('error: required resize frame buffer callback');
    map.off('resize', this.resizeFramebuffer);
    gl.deleteTexture(this.computationTexture);
    gl.deleteBuffer(this.drawingVerticesBuffer);
    gl.deleteBuffer(this.computationVerticesBuffer);
    gl.deleteBuffer(this.indicesBuffer);
    gl.deleteFramebuffer(this.computationFramebuffer);
  }
  prerender(gl: WebGLRenderingContext, matrix: number[]): void {
    if (
      !this.framebufferWidth ||
      !this.framebufferHeight ||
      this.aPositionComputation === undefined ||
      !this.indicesNumber ||
      !this.canvas ||
      !this.canvas.width ||
      !this.canvas.height
    ) {
      throw new Error('error: missing options for prerendering');
    }
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.useProgram(this.computationProgram);
    gl.uniformMatrix4fv(this.uMatrixComputation, false, matrix);
    gl.uniform1f(this.uP, this.p);
    gl.uniform2f(
      this.uFramebufferSize,
      this.framebufferWidth,
      this.framebufferHeight,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.computationFramebuffer);
    gl.viewport(0, 0, this.framebufferWidth, this.framebufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
    for (let i = 0; i < this.points.length; i += 1) {
      const point = this.points.at(i);
      if (!point) throw new Error(`error: point not found at index: ${i}`);
      gl.uniform1f(this.uUi, point[2]);
      gl.uniform2f(this.uXi, point[0], point[1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.computationVerticesBuffer);
      gl.enableVertexAttribArray(this.aPositionComputation);
      gl.vertexAttribPointer(
        this.aPositionComputation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
      if (this.textureCoverSameAreaAsROI) {
        gl.drawElements(gl.TRIANGLES, this.indicesNumber, gl.UNSIGNED_BYTE, 0);
      } else {
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  render(gl: WebGLRenderingContext, matrix: number[]): void {
    if (
      this.aPositionDraw === undefined ||
      !this.canvas ||
      !this.canvas.width ||
      !this.canvas.height ||
      !this.indicesNumber
    ) {
      throw new Error('error: missing options for rendering');
    }
    gl.useProgram(this.drawProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.drawingVerticesBuffer);
    gl.enableVertexAttribArray(this.aPositionDraw);
    gl.vertexAttribPointer(this.aPositionDraw, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.uMatrixDraw, false, matrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.computationTexture);
    gl.uniform1i(this.uComputationTexture, 0);
    gl.uniform2f(this.uScreenSizeDraw, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uOpacity, this.opacity);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
    gl.drawElements(gl.TRIANGLES, this.indicesNumber, gl.UNSIGNED_BYTE, 0);
  }
}
/**
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string } source - source of the shader
 * @returns {WebGLShader | undefined} - compiled shader
 */
function createVertexShader(
  gl: WebGLRenderingContext,
  source: string,
): WebGLShader | undefined {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  if (vertexShader) return compileShader(gl, vertexShader, source);
}
/**
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string } source - source of the shader
 * @returns {WebGLShader | undefined} - compiled shader
 */
function createFragmentShader(
  gl: WebGLRenderingContext,
  source: string,
): WebGLShader | undefined {
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (fragmentShader) return compileShader(gl, fragmentShader, source);
}
/**
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLShader} shader - shader to compile
 * @param {string} source - source of the shader
 * @returns {WebGLShader | undefined} - compiled shader
 */
function compileShader(
  gl: WebGLRenderingContext,
  shader: WebGLShader,
  source: string,
): WebGLShader | undefined {
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw gl.getShaderInfoLog(shader);
  }
  return shader;
}

/**
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLShader} vertexShader - vertext shader
 * @param {WebGLShader} fragmentShader - fragment shader
 * @returns {WebGLProgram | null} - compiled program
 */
function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (program) {
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(program);
    }
  }
  return program;
}
export { MapboxInterpolateHeatmapLayer };
