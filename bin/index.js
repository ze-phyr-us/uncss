#!/usr/bin/env node
var uncss   = require('../lib/uncss.js'),
    utility = require('../lib/lib.js'),
    program = require('commander'),
    buffer  = '',
    options;

program
    .version('0.4.4')
    .usage('[options] <file ...>')
    .option('-c, --compress', 'Compress CSS output')
    .option('-i, --ignore <selector, ...>', 'Do not remove given selectors')
    .parse(process.argv);

options = {
    compress: program.compress || false,
    ignore: program.ignore
        ? program.ignore.split(', ')
        : []
};

if (program.args.length === 0) {
    // No files were specified, read html from stdin
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', function (chunk) {
        buffer += chunk;
    });

    process.stdin.on('end', function () {
        uncss(buffer, options, function (uncss) {
            console.log(uncss);
        });
    });
} else {
    uncss(program.args, options, function (uncss) {
        console.log(uncss);
    });
}

