module.exports = function(config) {
  config.set({
    reporters: ['spec'],
    frameworks: ['browserify', 'tap'],
    browsers: ['Electron'],
    files: [
      'test/**/*.test.js'
    ],
    preprocessors: {
      'test/**/*.test.js': [ 'browserify' ]
    }
  });
};
