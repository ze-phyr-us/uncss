/*jslint node: true */
(function (module) {
    "use strict";

    var async   = require('async'),
        css     = require('css'),
        csso    = require('csso'),
        cheerio = require('cheerio'),
        path    = require('path'),
        lib     = require('./lib.js');

    /**
     * Filter the unused rules, using lib.filterUnusedRules
     * @param  {Array}    doms        List of DOMs loaded by cheerio
     * @param  {Array}    stylesheets List of CSS files
     * @param  {Object}   options     Options, as passed to uncss
     * @param  {Function} callback
     * @return {String}               The final, really used, CSS
     */
    function removeUnusedCSS(doms, stylesheets, options, callback) {
        var parsed_css = css.parse(stylesheets.join('\n')),
            used_css;

        // Remove unused rules and return the stylesheets to strings
        used_css = lib.filterUnusedRules(
            doms,
            parsed_css.stylesheet,
            options.ignore
        );
        used_css = css.stringify(used_css);
        // Minify?
        if (options.compress) {
            used_css = csso.justDoIt(used_css);
        }
        callback(null, used_css);
    }

    /**
     * Get the stylesheets' locations from an HTML file.
     * @param  {Array}    files    List of the HTML filenames
     * @param  {Array}    html     List of the html read from the [files]
     * @param  {Object}   options  Options, as passed to the uncss function
     * @param  {Function} callback
     * @return {Array}             List of CSS files
     */
    function extractStylesheets(files, html, callback) {
        var doms, stylesheets;
        // Parse the HTML.
        doms = html.map(function (dom) {
            return cheerio.load(dom);
        });

        // Extract the stylesheets from the HTML
        stylesheets = doms.map(function (html) {
            var links = html('link[rel="stylesheet"]');
            // Links is not an array, but an object whose elements are indexes
            return links.map(function (x) {
                return links[x].attribs.href;
            });
        });

        if (stylesheets[0].length === 0) {
            // Could not extract a css file
            callback('No stylesheets found.', null);
            return;
        }

        // Now we have:
        //   files       = ['some_file.html', 'some_other_file.html']
        //   stylesheets = [['relative_css_path.css', ...],
        //                  ['maybe_a_duplicate.css', ...]]
        // We need to - make the stylesheets' paths relative to the HTML files,
        //            - flatten the array,
        //            - remove duplicates
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
        lib.mapReadFiles(stylesheets, function (contents) {
            callback(null, doms, contents);
        });
    }

    /**
     * Main exposed function
     * @param  {Array}    files Array of filenames
     * @param  {Object}   opt   Options
     * @param  {Function} cb    Callback
     */
    function uncss(files, opt, cb) {
        var callback,
            options;

        if (typeof opt === 'function') {
            // There were no options.
            // This argument is really the callback
            options = {};
            callback = opt;
        } else if (typeof opt === 'object' && typeof cb === 'function') {
            options = opt;
            callback = cb;
        } else {
            throw 'TypeError: expected a callback';
        }
        // If 'files' is a string, it should represent an HTML page.
        if (typeof files === 'string') {
            // Skip step 1 and go to the parsing
            files = [files];
            extractStylesheets(files, function (doms, stylesheets) {
                removeUnusedCSS(doms, stylesheets, options, callback);
            });
        } else {
            async.waterfall([
                // First, read the HTML files
                function (callback) {
                    async.map(files, lib.Phantom, function (res) {
                        if (typeof res !== 'Array') {
                            res = [res];
                        }
                        callback(null, files, res);
                    });
                },
                // Then, get the stylesheets
                function (files, html, callback) {
                    extractStylesheets(files, html, callback);
                },
                // And finally, remove the unused CSS
                function (doms, stylesheets, callback) {
                    removeUnusedCSS(doms, stylesheets, options, callback);
                }],
                // All the work is done. Just check if there were any errors,
                //   then execute the callback
                function (err, results) {
                    if (err) {
                        throw err;
                    }
                    callback(results);
                });
        }
    }

    module.exports = uncss;

}(module));
