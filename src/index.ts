import fs from 'fs';
import http from 'http';

interface Ipage {
    component: (object | null);
    imports: any[];
}

interface Idpage {
    ifs: any[];
    variables: any[];
    functions: any[];
    prints: any[];
    return: (object | null);
}

function split(text: string, delimiter: string, type: string = `first`): [string, string] | string {
    let delimiterIndex;

    if (type === `last`) delimiterIndex = text.lastIndexOf(delimiter);
    else delimiterIndex = text.indexOf(delimiter);

    if (delimiterIndex === -1) return ``;

    const beforeText = text.substring(0, delimiterIndex);
    const afterText = text.substring(delimiterIndex + delimiter.length);

    return [beforeText, afterText];
}

export class Bact {
    pages: any[];

    public constructor() {
        this.pages = [];
    }

    public defaultConv(text: string = ``) {
        let detailPage: Idpage = {
            ifs: [],
            variables: [],
            functions: [],
            prints: [],
            return: null
        };

        text.split(`\n`).forEach(lineText => {
            lineText = lineText.trim();

            if (lineText.startsWith(`//`)) return;

            if (lineText.startsWith(`print`)) {
                detailPage.prints = [...detailPage.prints, split(split(lineText, `(`)[1], `)`)[0].replace(/(\`|\'|\"|\(|\)|\[|\]|\{|\})/g, ``)];
            }

            if (lineText.startsWith(`if`)) {
                let ifobj = {
                    condition: split(split(lineText, `if`)[1], `{`)[0].trim().split(` `),
                    ifTrue: this.defaultConv(split(split(text, lineText)[1], `}`)[0]),
                    ifFalse: split(text, split(split(text, lineText)[1], `}`)[0])[1].includes(`else`) ? this.defaultConv(split(split(split(split(text, split(split(text, lineText)[1], `}`)[0])[1], `else`)[1], `{`)[1], `} end if`)[0]) : ``
                };

                detailPage.ifs = [...detailPage.ifs, ifobj];
            }

            if (lineText.startsWith(`@State`)) {
                let variable = {
                    type: `state`,
                    key: split(split(split(lineText, `@State`)[1], `set`)[1], `->`)[0].trim(),
                    value: split(split(split(split(lineText, `@State`)[1], `set`)[1], `->`)[1], `;`)[0].trim()
                };

                detailPage.variables = [...detailPage.variables, variable];
            }

            if (lineText.startsWith(`set`)) {
                let variable = {
                    type: `variable`,
                    key: split(split(lineText, `set`)[1], `->`)[0].trim(),
                    value: split(split(split(lineText, `set`)[1], `->`)[1], `;`)[0].trim()
                };

                let stopped = false;

                detailPage.variables.forEach(_variable => {
                    if (variable.key === _variable.key) {
                        stopped = true;
                    }
                });

                if (stopped === false) {
                    detailPage.variables = [...detailPage.variables, variable];
                }
            }

            if (lineText.startsWith(`define`)) {
                let func: any = {
                    name: split(split(lineText, `define`)[1], `[`)[0].trim(),
                    params: [],
                    function: this.defaultConv(split(split(text, lineText)[1], `} end define`)[0])
                };

                lineText.split(`define`)[1].split(`[`)[1].split(`]`)[0].split(`,`).forEach(object => {
                    func.params = [...func.params, {
                        key: split(object, `:`)[0].trim(),
                        get: split(object, `:`)[1].includes(`|`) ? split(object, `:`)[1].replace(/(\(|\))/g, ``).split(`|`).map(e => e.trim()) : [split(object, `:`)[1].replace(/(\(|\))/g, ``).trim()]
                    }];
                });

                detailPage.functions = [...detailPage.functions, func];
            }

            if (lineText.startsWith(`return`)) {
                let _return = {
                    content: split(split(text, lineText)[1], `) end return`)[0]
                };

                detailPage.return = _return;
            }
        });

        return detailPage;
    }

    public conv(text: string = ``) {
        let page: Ipage = {
            component: null,
            imports: []
        };

        text.split(`\n`).forEach(lineText => {
            lineText = lineText.trim();

            if (lineText.startsWith(`//`)) return;

            if (lineText.startsWith(`import`)) {
                page.imports = [...page.imports, {
                    name: split(split(lineText, `import`)[1], `->`)[0].trim(),
                    component: this.conv(fs.readFileSync(`${split(split(split(lineText, `import`)[1], `->`)[1], `;`)[0].replace(/(\`|\'|\"|\(|\)|\[|\]|\{|\})/g, ``).trim()}`, `utf-8`))
                }];
            }

            if (lineText.startsWith(`@View`)) {
                let component: any = {
                    name: split(split(split(lineText, `@View`)[1], `define`)[1], `[`)[0].trim(),
                    params: [],
                    function: this.defaultConv(split(split(text, lineText)[1], `} end define`, `last`)[0])
                };
                
                page.component = component;
            }
        });

        return page;
    }

    public compile(path: string = `./src/`) {
        fs.readdirSync(path).forEach(file => {
            if (fs.lstatSync(`${path}${file}`).isDirectory()) {
                this.compile(`${path}${file}/`);
            } else {
                if (file.toLowerCase().endsWith(`.bact`)) {
                    const component = this.conv(fs.readFileSync(`${path}${file}`, `utf-8`));
                    this.pages = [...this.pages, component];
                }
            }
        });
    }

    public build() {
        this.compile();

        const server = http.createServer((req, res) => {
            res.writeHead(200, { 'content-Type': 'text/html' });

            if (req.url === `/bundle.js`) {
                res.end(fs.readFileSync(`${__dirname}/bundle.js`));
            }

            this.pages.forEach(page => {
                if (page.component === null) return;

                if (req.url === `/${page.component.name}`) {
                    const renewcontent = page.component.function.return.content.replace(/([a-zA-Z0-9-]+)=\$\{(.*)\}/g, ``);

                    res.end(
                        `<script src="/bundle.js"></script>` + 
                        renewcontent
                    );
                }
            });
        });

        server.listen(3000, () => {
            console.log(` * Server Started.`);
        });
    }
}