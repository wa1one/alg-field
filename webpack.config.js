const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

// This package is built on BigInt, so it cannot run anywhere below ES2020
// regardless of how it is transpiled. `esmodules: true` was looser than that
// - it includes engines that predate BigInt - so targeting the oldest
// BigInt-capable engines instead costs nothing in reach and lets preset-env
// emit less down-levelled code. It also rules out the `**` -> Math.pow()
// rewrite that ES5 output performs, which breaks BigInt exponentiation.
const BIGINT_CAPABLE_TARGETS = {
  node: "10.4",
  chrome: "67",
  edge: "79",
  firefox: "68",
  safari: "14",
};

const babelRule = {
  test: /\.(js|jsx)$/,
  exclude: /node_modules/,
  loader: "babel-loader",

  options: {
    presets: [
      ["@babel/preset-env", { targets: BIGINT_CAPABLE_TARGETS, bugfixes: true }],
      {
        plugins: ["@babel/plugin-proposal-class-properties"],
      },
    ],
  },
};

// Minification is configured explicitly rather than left to webpack's
// implicit production default, so the published output stays stable across
// webpack upgrades. Deliberately no `unsafe_*` compressor flags: they can
// change semantics.
const minimizer = [
  new TerserPlugin({
    extractComments: false,
    terserOptions: {
      compress: { passes: 2 },
      format: { comments: false },
    },
  }),
];

module.exports = [
  {
    entry: "./src/index.js",
    output: {
      filename: "index.js",
      path: path.resolve(__dirname, "dist"),
      library: "alg-field",
      libraryTarget: "umd",
    },

    externals: {},
    module: {
      rules: [babelRule],
    },

    optimization: { minimize: true, minimizer },

    target: ["node", "es6"],
  },
  {
    entry: "./src/index.js",
    output: {
      filename: "index.js",
      path: path.resolve(__dirname, "dist-web"),
      library: "alg-field",
      libraryTarget: "umd",
    },

    module: {
      rules: [babelRule],
    },

    optimization: { minimize: true, minimizer },

    target: ["web", "es6"],
    resolve: {
      fallback: {},
    },
  },
];
