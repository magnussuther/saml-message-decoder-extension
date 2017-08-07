const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    index: './src/index.js',
    listener: './src/listener.js',
  },
  output: {
    filename: '[name].js', // index.js, listener.js
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [{
      test: /\.js$/,
      use: ['babel-loader'],
    }, {
      test: /\.css$/,
      use: [
        'style-loader',
        'css-loader',
      ],
    }, {
      test: /\.woff2$/,
      use: ['file-loader'],
    }],
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
    }),
    // Needed to make IScroll globally accessible.
    new webpack.ProvidePlugin({
      IScroll: 'fullpage.js/vendors/scrolloverflow',
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      chunks: ['index'],
    }),
    new CopyWebpackPlugin([
      { from: './src/static', to: 'static' },
    ]),
    new CopyWebpackPlugin([
      { from: './src/manifest.json' },
    ]),
  ],
};
