const path = require('path');
const fs = require('fs');
const markdownParser = require('./markdownParser');
const Gherkin = require('gherkin');
const parser = new Gherkin.Parser();
parser.stopOnFirstError = false;
const stepsParser = require('./dist/stepsParser');

const processor = {
    scenaria: [],
    scenariaPerTag: [],
    codeParser: null,

    /**
     * Process a feature files' directory
     * @param {String} filename the features' directory
     * @param {String} outputDir where to output the generated html files
     * @param {Object} options the options to send to the processor. Currently only 'steps' is supported
     * @returns {Object} the adapted Gherkin Tree
     */
    process: function(filename, outputDir, options) {
        processor.codeParser = new stepsParser.CodeParser(options ? options.steps : []);
        const tree = processor.traverseDirectory(filename, outputDir, path.dirname(filename), options);
        processor.associateTags(processor.scenaria);
        tree.scenaria = processor.scenaria;
        tree.scenariaPerTag = processor.scenariaPerTag;
        tree.tags = [];
        for (const tag in tree.scenariaPerTag) {
            tree.tags.push({ name: tag, count: tree.scenariaPerTag[tag].length });
        }
        // Sort tags by name
        tree.tags.sort(function(aTag, bTag) {
            if (aTag.name < bTag.name) {return -1;}
            if (aTag.name > bTag.name) {return 1;}
            return 0;
        });
        return tree;
    },

    createImplementedTag: function(obj, implemented, options) {
        if (!obj.tags) { obj.tags = []; }
        if (options.addImplementedTags) {
            obj.tags.push({ type: 'Tag', location: { line: 0, column: 0 },
                name: implemented ? 'Implemented' : 'Not Implemented' });
        }
    },

    /**
     * Traverse a features directory and subdirectories and construct
     * a tree representing the features as GherkinDocuments
     * @param {string} filename the directory to Traverse
     * @param {string} outputDir the directory where the results will be stored
     * @param {string} basename path.dirname(filename)
     * @param {object} options the options to be referenced when processing files
     * @return {Object} treeNode
     */
    traverseDirectory: function(filename, outputDir, basename, options) {
        const stats = fs.lstatSync(filename);
        let treeNode = null;

        if (stats.isDirectory()) {
            const children = fs.readdirSync(filename).map(function(child) {
                return processor.traverseDirectory(filename + '/' + child, outputDir, basename, options);
            });
            treeNode = {
                path: filename,
                tocName: filename.replace(outputDir + '/', ''),
                name: path.basename(filename),
                link: null,
                writePath: filename.replace(basename, outputDir),
                type: 'directory',
                children: children,
                document: null,
            };
        }
        else {
            let nonFeature = true;
            if (filename.endsWith('.feature')) {
                // parse feature file
                try {
                    const gherkinDoc = processor.parseFeature(filename);
                    nonFeature = false;
                    // clean tagnames
                    gherkinDoc.feature.tags.forEach(tag => {
                        tag.name = tag.name.replace('@', '');
                    });
                    let implementedFeature = true;
                    gherkinDoc.feature.children.forEach(child => {
                        if (child.tags) {
                            child.tags.forEach(tag => {
                                tag.name = tag.name.replace('@', '');
                            });
                        }
                        // Escape "argument content," i.e., multi-line string input to a step
                        // This may contain code blocks OR Cucumber-style interpolated variables like <Column 1>
                        if (child.steps) {
                            child.steps.forEach(step => {
                                if (step.argument && step.argument.content) {
                                    step.argument.content = step.argument.content.trim()
                                                                .replace(/&/g, "&amp;")
                                                                .replace(/>/g, "&gt;")
                                                                .replace(/</g, "&lt;")
                                                                .replace(/"/g, "&quot;");
                                }
                            });
                        }
                        let implementedStep = true;
                        // Find the steps in-code
                        child.steps.forEach(step => {
                            if (step.type === 'Step') {
                                step.implementation = processor.codeParser.ParseLine(step.keyword + step.text);
                            }
                            else {
                                // We shouldn't get here
                                console.log('Unrecognized step type "' + step.type + '"');
                            }
                            if (!step.implementation.stepMatch) { implementedStep = false; }
                            processor.createImplementedTag(step, implementedStep, options);
                        }, this);
                        if (!implementedStep) { implementedFeature = false; }
                        processor.createImplementedTag(child, implementedStep, options);
                    });
                    /**
                     * If we add here a tag, all the scenarios will inherit it
                     * so we can't do it, we need to find an alternative way
                     */
                    // processor.createImplementedTag(gherkinDoc.feature, implementedFeature);
                    gherkinDoc.feature.implementation = implementedFeature;

                    // collect scenaria for further processing
                    gherkinDoc.feature.children.forEach(child => {
                        child.featureTags = gherkinDoc.feature.tags;
                        child.featureName = gherkinDoc.feature.name;
                    });
                    processor.scenaria = processor.scenaria.concat(gherkinDoc.feature.children);
                    // Determine the path to root folder
                    const rootFolder = path.relative(filename + '/..', basename);
                    // construct tree node
                    treeNode = {
                        path: filename,
                        rootFolder: rootFolder ? rootFolder + '/' : '',
                        name: path.basename(filename),
                        tocName: gherkinDoc.feature.name,
                        link: filename.replace(basename, '.') + '.html',
                        writePath: filename.replace(basename, outputDir) + '.html',
                        children: null,
                        type: 'featurefile',
                        document: gherkinDoc,
                    };
                }
                catch (e) {
                    console.warn(e);
                    nonFeature = true;
                }
            }
            if (nonFeature) {
                treeNode = {
                    path: filename,
                    name: path.basename(filename),
                    tocName: null,
                    link: null,
                    writePath: filename.replace(basename, outputDir),
                    children: null,
                    type: 'file',
                    document: null,
                };
            }
        }

        return treeNode;
    },

    /**
     * Parse a feature file whith Gherkin parser and transform it to Gherkin ast
     * @param {String} featureFilename the filename fo the feature
     * @returns {Object} the Gherkin document
     */
    parseFeature: function(featureFilename) {
        const featureBody = fs.readFileSync(featureFilename, 'UTF-8');
        const gherkinDocument = parser.parse(featureBody);

        // Parse markdown
        gherkinDocument.feature.description = markdownParser.markdownToHtml(gherkinDocument.feature.description);
        gherkinDocument.feature.children.forEach(child => {
            child.description = markdownParser.markdownToHtml(child.description);
        });
        return gherkinDocument;
    },

    /**
     * Create associations between tags and scenaria
     * @param {Object} scenaria The scenarios to associate with the tags
     * @returns {void}
     */
    associateTags: function(scenaria) {
        scenaria.forEach(scenario => {
            // inherit feature tags
            if (scenario.tags) {
                scenario.tags = scenario.tags.concat(scenario.featureTags);
            }
            else {
                scenario.tags = scenario.featureTags;
            }
            // process tags
            scenario.tags.forEach(tag => {
                const tagName = tag.name;
                if (!processor.scenariaPerTag[tagName]) {
                    processor.scenariaPerTag[tagName] = [];
                }
                processor.scenariaPerTag[tagName].push(scenario);
            });
        });
    },
};

module.exports = processor;
