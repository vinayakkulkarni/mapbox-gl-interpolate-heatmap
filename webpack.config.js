const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'interpolateHeatmapLayer.js',
        library: {
            name: 'interpolateHeatmapLayer',
            type: 'umd',
        },
        globalObject: 'this'
    },
    mode: 'production'
};