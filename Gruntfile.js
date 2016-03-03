module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      all: ['Gruntfile.js', 'src/**/*.js'],
      options: {
        'loopfunc': true,
        'esversion': 6,
        'eqeqeq': true,
        'forin': true,
        'unused': true
      }
    },
    browserify: {
      build: {
        options: {
          transform: [['babelify', {presets: ['es2015']}]]
        },
        src: 'src/**/*.js',
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      build: {
        files: {
        'dist/<%= pkg.name %>.min.js': ['dist/<%= pkg.name %>.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('build', ['browserify', 'uglify']);
  grunt.registerTask('default', ['test', 'build']);
};

