const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const appDirectory = path.resolve(__dirname);
const { presets } = require(`${appDirectory}/babel.config.js`);

const compileNodeModules = [
    // Add every react-native package that needs compiling
    // 'react-native-gesture-handler',
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

const babelLoaderConfiguration = {
    test: /\.jsx?$/, // .js and .jsx files
    include: [
        path.resolve(appDirectory, 'index.web.js'),
        path.resolve(appDirectory, 'App.tsx'),
        path.resolve(appDirectory, 'src'),
        path.resolve(appDirectory, 'Signaling.js'), // Include Signaling.js
        path.resolve(appDirectory, 'react-native-webrtc.web.js'),
        path.resolve(appDirectory, 'react-native-geolocation-service.web.js'),
        path.resolve(appDirectory, 'node_modules/react-native-uncompiled'),
        ...compileNodeModules,
    ],
    use: {
        loader: 'babel-loader',
        options: {
            cacheDirectory: true,
            presets,
            plugins: ['react-native-web'],
        },
    },
};

const tsLoaderConfiguration = {
    test: /\.tsx?$/,
    include: [
        path.resolve(appDirectory, 'index.web.js'),
        path.resolve(appDirectory, 'App.tsx'),
        path.resolve(appDirectory, 'src'),
        path.resolve(appDirectory, 'Signaling.js'),
    ],
    use: {
        loader: 'babel-loader',
        options: {
            cacheDirectory: true,
            presets,
            plugins: ['react-native-web'],
        },
    },
};

const imageLoaderConfiguration = {
    test: /\.(gif|jpe?g|png|svg)$/,
    use: {
        loader: 'url-loader',
        options: {
            name: '[name].[ext]',
        },
    },
};

module.exports = {
    entry: [
        // load any web API polyfills
        // path.resolve(appDirectory, 'polyfills-web.js'),
        // your web-specific entry file
        path.resolve(appDirectory, 'index.web.js'),
    ],

    // configures where the build ends up
    output: {
        filename: 'bundle.web.js',
        path: path.resolve(appDirectory, 'dist'),
    },

    module: {
        rules: [
            babelLoaderConfiguration,
            tsLoaderConfiguration,
            imageLoaderConfiguration,
        ],
    },

    resolve: {
        // If you're working on a multi-platform React Native app, web-specific
        // module implementations should be written in files using the extension
        // `.web.js`.
        extensions: ['.web.js', '.js', '.web.jsx', '.jsx', '.web.tsx', '.tsx'],
        alias: {
            'react-native$': 'react-native-web',
            'react-native-webrtc': path.resolve(appDirectory, 'react-native-webrtc.web.js'),
            'react-native-geolocation-service': path.resolve(appDirectory, 'react-native-geolocation-service.web.js'),
        },
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(appDirectory, 'public/index.html'),
        }),
        new webpack.DefinePlugin({
            __DEV__: process.env.NODE_ENV !== 'production',
        }),
    ],
};
