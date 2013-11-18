/*jslint node: true */
"use strict";

var css     = require('css'),
    csso    = require('csso'),
    cheerio = require('cheerio'),
    path    = require('path'),
    utility = require('./lib.js');

/**
 * Main exposed function
 * @param  {Array}    files array of filenames
 * @param  {Object}   opt       options
 * @param  {Function} cb        callback
 * @return {String}             uncss'd css
 */
function uncss(files, opt, cb) {
    var callback,
        stylesheets,
        doms,
        options,
        parsed_css,
        used_css;

    /* If 'files' is a string, it should represent an HTML page. */
    if (typeof files === 'string') {
        doms = [files];
    } else {
        doms = utility.mapReadFiles(files);
    }
    if (typeof opt === 'function') {
        /* There were no options,
         *  this argument is really the callback
         */
        options = {};
        callback = opt;
    } else if (typeof opt === 'object' && typeof cb === 'function') {
        options = opt;
        callback = cb;
    } else {
        throw 'TypeError: expected a callback';
    }

    /* Parse the HTML. */
    doms = doms.map(function (dom) {
        return cheerio.load(dom);
    });

    /* Only extract stylesheet paths from the HTML if they are not provided in the options. */
    if (options.stylesheets) {
        stylesheets = options.stylesheets;
    }
    else {
        /* Extract the stylesheets from the HTML */
        stylesheets = doms.map(function (html) {
            return utility.extract_stylesheets(html);
        });

        if (stylesheets[0].length === 0) {
            /* Could not extract a css file */
            callback('');
            return;
        }

        /* Now we have:
         *  files       = ['some_file.html', 'some_other_file.html']
         *  stylesheets = [['relative_css_path.css', ...],
         *                 ['maybe_a_duplicate.css', ...]]
         * We need to - make the stylesheets' paths relative to the HTML files,
         *            - flatten the array,
         *            - remove duplicates
         */
        stylesheets = stylesheets.map(function (arr, i) {
            return arr.map(function (el) {
                return path.join(path.dirname(files[i]), el);
            });
        });
        stylesheets = stylesheets.concat.apply([], stylesheets);
        stylesheets = stylesheets.filter(function (e, i, arr) {
            return arr.lastIndexOf(e) === i;
        });
    }

    /* Read the stylesheets and parse the CSS */
    stylesheets  = utility.mapReadFiles(stylesheets);
    parsed_css = css.parse(stylesheets.join('\n'));

    /* Remove unused rules and return the stylesheets to strings */
    used_css = utility.filterUnusedRules(doms, parsed_css.stylesheet, options.ignore);
    used_css = css.stringify(used_css);
    /*  Minify? */
    if (options.compress) {
        used_css = csso.justDoIt(used_css);
    }
    callback(used_css);
}

module.exports = uncss;
