/*jslint node: true */
"use strict";

var css     = require('css'),
    csso    = require('csso'),
    cheerio = require('cheerio'),
    path    = require('path'),
    utility = require('./lib.js');

function removeUnusedCSS(doms, stylesheets, options, callback) {
    var parsed_css = css.parse(stylesheets.join('\n')),
        used_css;

    /* Remove unused rules and return the stylesheets to strings */
    used_css = utility.filterUnusedRules(doms, parsed_css.stylesheet, options.ignore);
    used_css = css.stringify(used_css, { compress: options.compress || false });
    /*  Minify? */
    if (options.compress) {
        used_css = csso.justDoIt(used_css);
    }
    callback(used_css);
}

/**
 * Callback executed when the HTML files are read.
 * @param  {Array}    files    List of the HTML filenames
 * @param  {Array}    contents List of the contents read from the [files]
 * @param  {Object}   options  Options, as passed to the uncss function
 * @param  {Function} callback Callback to execute when the shtylesheets are
 *                             extracted
 */
function extractStylesheets(files, contents, options, callback) {
    var doms, stylesheets;
    /* Parse the HTML. */
    doms = contents.map(function (dom) {
        return cheerio.load(dom);
    });

    /* Extract the stylesheets from the HTML */
    stylesheets = doms.map(function (html) {
        var links = html('link[rel="stylesheet"]');
        /* Links is not an array, but an object whose elements are indexes */
        return links.map(function (x) {
            return links[x].attribs.href;
        });
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

    /* Read the stylesheets and parse the CSS */
    utility.mapReadFiles(stylesheets, function (contents) {
        removeUnusedCSS(doms, contents, options, callback);
    });
}

/**
 * Main exposed function
 * @param  {Array}    files array of filenames
 * @param  {Object}   opt       options
 * @param  {Function} cb        callback
 * @return {String}             uncss'd css
 */
function uncss(files, opt, cb) {
    var callback,
        options;

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
    /* If 'files' is a string, it should represent an HTML page. */
    if (typeof files === 'string') {
        files = [files];
        extractStylesheets(files, callback);
    } else {
        utility.mapReadFiles(files, function (contents) {
            extractStylesheets(files, contents, options, callback);
        });
    }
}

module.exports = uncss;
