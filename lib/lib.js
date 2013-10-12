/*jslint node: true, plusplus: true, stupid: true */

"use strict";

var async = require('async'),
    fs = require('fs');

/**
 * Given an array of filenames, return an array of the files' contents,
 *  only if the filename matches a regex
 * @param  {Array}    files    An array of the filenames to read
 * @param  {Function} callback Callback to execute when all files are read
 * @return {Array}             List of the files' contents
 */
function mapReadFiles(files, callback) {
    function readAsync(file, callback) {
        fs.readFile(file, 'utf8', callback);
    }

    async.filter(files, fs.exists, function (results) {
        async.map(results, readAsync, function (err, data) {
            if (err) {
                throw err;
            }
            callback(data);
        });
    });
}

/**
 * Private function used in filterUnusedRules.
 * @param  {Object}  doms      List of DOMs loaded by cheerio
 * @param  {Array}   selectors CSS selectors created by the CSS parser
 * @return {Array}             The selectors matched in the DOMs
 */
function filterUnusedSelectors(doms, selectors, ignore) {
    /* There are some selectors not supported for matching, like
     *   :before, :after
     * They should be removed only if the parent is not found.
     * Example: '.clearfix:before' should be removed only if there
     *          is no '.clearfix'
     */
    return selectors.filter(function (selector) {
        var match, i, temp;
        /* Don't process @-rules (for now?) */
        if (selector[0] === '@') {
            return true;
        }
        if (ignore.indexOf(selector) !== -1) {
            return true;
        }
        /* For each DOM, match the selector */
        for (i = 0; i < doms.length; ++i) {
            /* Another way would be to list all the unsupported pseudos */
            try {
                match = doms[i](selector);
            } catch (e) {
                /* Remove ':' pseudos.
                 * TODO: check all possible cases
                 */
                temp =
                    selector
                    /* Ignore quoted spaces (a:hover > [class*=" icon-"])
                     *                                          ^        */
                    .match(/(?:[^\s"]+|"[^"]*")+/g)
                    /* Ignore quoted ':' (a[href="javascript:"]:hover)
                     *                                      ^         */
                    .map(function (str) {
                        return str.match(/(?:[^ :"]+|"[^"]*")+/g)[0];
                    }).join(' ');
                match = doms[i](temp);
            }
            if (match.length !== 0) {
                return true;
            }
        }
        return false;
    });
}

/**
 * Remove css rules not used in the dom
 * @param  {Object}  doms       List of DOMs loaded by cheerio
 * @param  {Object}  stylesheet The output of css.parse().stylesheet
 * @return {Array}              The rules matched in the dom
 */
function filterUnusedRules(doms, stylesheet, ignore) {
    var rules = stylesheet.rules;
    /* Rule format:
     *  { selectors: [ '...', '...' ],
     *    declarations: [ { property: '...', value: '...' } ]
     *  },
     * Two steps: filter the unused selectors for each rule,
     *            filter the rules with no selectors
     */
    rules.forEach(function (rule) {
        if (rule.type === 'rule') {
            rule.selectors =
                filterUnusedSelectors(doms, rule.selectors, ignore);
        } else if (rule.type === 'media') {
            /* Recurse */
            rule.rules = filterUnusedRules(
                doms,
                { rules: rule.rules },
                ignore
            ).stylesheet.rules;
        }
    });

    rules = rules.filter(function (rule) {
        /* Filter the rules with no selectors (i.e. the unused rules) */
        if (rule.type === 'rule' && rule.selectors.length === 0) {
            return false;
        }
        /* Filter media queries with no remaining rules */
        if (rule.type === 'media' && rule.rules.length === 0) {
            return false;
        }
        return true;
    });
    return { stylesheet: { rules: rules } };
}

module.exports.mapReadFiles = mapReadFiles;
module.exports.filterUnusedRules = filterUnusedRules;
