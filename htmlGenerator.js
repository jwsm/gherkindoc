var Mustache = require('mustache');
var marked = require('marked');
var fs = require('fs');

var defaultOptions = {
    theme: 'cosmo',
    renderScenaria: true
}

var htmlGenerator = {

    options: {},

    /**
     * Declaration of HTML templates
     */
    htmlTemplates: {
        index: fs.readFileSync(__dirname + '/templates/index.mustache', 'UTF-8'),
        main: fs.readFileSync(__dirname + '/templates/main.mustache', 'UTF-8'),
        feature: fs.readFileSync(__dirname + '/templates/feature.mustache', 'UTF-8'),
        tag: fs.readFileSync(__dirname + '/templates/tag.mustache', 'UTF-8'),
        scenario: fs.readFileSync(__dirname + '/templates/scenario.mustache', 'UTF-8'),
        header: fs.readFileSync(__dirname + '/templates/header.mustache', 'UTF-8'),
        footer: fs.readFileSync(__dirname + '/templates/footer.mustache', 'UTF-8'),
        toc: fs.readFileSync(__dirname + '/templates/toc.mustache', 'UTF-8'),
        tocNode: fs.readFileSync(__dirname + '/templates/tocNode.mustache', 'UTF-8'),
        css: fs.readFileSync(__dirname + '/templates/css.mustache', 'UTF-8')
    },

    /**
     * Generate documentation site
     * @param tree the 'enhanced' GherkinDoc tree generated by Processor module
     * @param outputDir the directory where the files will be stored
     * @options additional options object - see README.md
     */
    generate: function (tree, outputDir, options) {
        htmlGenerator.processOptions(options);
        htmlGenerator.generateFeaturePages(tree);
        if (fs.existsSync(outputDir + '/tags')) {
            del.sync(outputDir + '/tags');
        }
        fs.mkdirSync(outputDir + '/tags');
        tree.tags.forEach(tag => {
            htmlGenerator.generateTagHtml(tree, tag.name, outputDir);
        });
        htmlGenerator.generateIndex(tree, outputDir);
        htmlGenerator.generateTocHtml(tree, outputDir);
    },

    /**
     * Recursively Generate an HTML file per each feature
     * @param treeNode
     */
    generateFeaturePages: function (treeNode) {
        if (treeNode.type == 'featurefile') {
            var output = Mustache.render(htmlGenerator.htmlTemplates.feature, { document: treeNode.document, rootFolder: treeNode.rootFolder, options: htmlGenerator.options }, htmlGenerator.htmlTemplates);
            fs.writeFileSync(treeNode.path + '.html', output);
        }
        if (treeNode.type == 'directory') {
            treeNode.children.forEach(childNode => {
                childNode = htmlGenerator.generateFeaturePages(childNode);
            });
        }
        return treeNode;
    },

    /**
     * Generate table of contents
     * @param tree the 'enhanced' GherkinDoc tree generated by Processor module
     * @param outputDir the directory where the files will be stored
     */
    generateTocHtml: function (tree, outputDir) {
        tree.options = htmlGenerator.options;
        var output = Mustache.render(htmlGenerator.htmlTemplates.toc, tree, htmlGenerator.htmlTemplates);
        fs.writeFileSync(outputDir + '/toc.html', output);
    },

    /**
     * Generate The index page
     * @param tree the 'enhanced' GherkinDoc tree generated by Processor module
     * @param outputDir the directory where the files will be stored
     */
    generateIndex: function (tree, outputDir) {
        tree.options = htmlGenerator.options;
        var output = Mustache.render(htmlGenerator.htmlTemplates.index, tree, htmlGenerator.htmlTemplates);
        fs.writeFileSync(outputDir + '/index.html', output);
        output = Mustache.render(htmlGenerator.htmlTemplates.main, tree, htmlGenerator.htmlTemplates);
        fs.writeFileSync(outputDir + '/main.html', output);
    },

    /**
     * Generate a tag's page
     * @param tree the 'enhanced' GherkinDoc tree generated by Processor module
     * @param tag the name of the tag to generate a page for
     */
    generateTagHtml: function (tree, tag, outputDir) {
        var output = Mustache.render(htmlGenerator.htmlTemplates.tag, { tag: tag, showFeatureName: true, scenaria: tree.scenariaPerTag[tag], rootFolder: '../', options: htmlGenerator.options }, htmlGenerator.htmlTemplates);
        fs.writeFileSync(outputDir + '/tags/' + tag + '.html', output);
    },

    /**
     * Parse the user provided options
     */
    processOptions: function (options) {
        if (typeof options == 'undefined' || !options || options == {}) {
            htmlGenerator.options = defaultOptions;
        }
        else {
            htmlGenerator.options.theme = options.theme ? options.theme : defaultOptions.theme;
            htmlGenerator.options.renderScenaria = options.renderScenaria != null ? options.renderScenaria : defaultOptions.renderScenaria;
        }

    }
}

module.exports = htmlGenerator
