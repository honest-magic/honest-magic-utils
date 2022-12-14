import {deepFreeze} from './freeze.js';


type StringProvider = string | (() => string)
type StringTransformer = null | undefined | ((value: string) => string)

export class StringTemplate {

    private _vars: Variable[] = [];
    private _nodes: Node[] = [];

    constructor(template: string) {

        // parse the string and save the places where the variables
        // are placed while remove the variables.

        let currentText = '';
        let currentVariable = '';
        let dollar = false;
        let declaringVariable = false;

        const chars = [...template];
        chars.forEach((c) => {
            switch (c) {
                case '$':
                    if (dollar) {
                        currentText += "$";
                        dollar = false;
                    } else {
                        dollar = true;
                    }
                    break;
                case '{':
                    if (dollar) {
                        declaringVariable = true;
                        if (currentText !== '') {
                            this.addNode(new TextNode(currentText));
                            currentText = '';
                        }
                    } else {
                        currentText += "{"
                        dollar = false;
                    }
                    break;
                case '}':
                    if (declaringVariable) {
                        declaringVariable = false;
                        if (currentVariable !== '') {

                            let transform: StringTransformer
                            // Check whether it ends with , ,, ^ ^^
                            if (currentVariable.endsWith('^^')) {
                                currentVariable = currentVariable.slice(0, -2)
                                if (currentVariable.length > 0) {
                                    transform = value => value.toUpperCase()
                                }
                            } else if (currentVariable.endsWith(',,')) {
                                currentVariable = currentVariable.slice(0, -2)
                                if (currentVariable.length > 0) {
                                    transform = value => value.toLowerCase()
                                }
                            } else if (currentVariable.endsWith('^')) {
                                currentVariable = currentVariable.slice(0, -1)
                                if (currentVariable.length > 0) {
                                    transform = value => value.charAt(0).toUpperCase() + value.slice(1)
                                }
                            } else if (currentVariable.endsWith(',')) {
                                currentVariable = currentVariable.slice(0, -1)
                                if (currentVariable.length > 0) {
                                    transform = value => value.charAt(0).toLowerCase() + value.slice(1)
                                }
                            }

                            let variable = this.getOrCreateVariable(currentVariable);
                            let varNode = new VariableNode(variable, transform);
                            variable.addNode(varNode);
                            this.addNode(varNode);
                            currentVariable = '';
                        }
                    } else {
                        currentText += "}";
                        dollar = false;
                    }
                    break;
                default:
                    dollar = false
                    if (declaringVariable) {
                        currentVariable += c;
                    } else {
                        currentText += c;
                    }

            }

        });

        if (currentText !== '') {
            this.addNode(new TextNode(currentText));
        }


        deepFreeze(this._vars);
        deepFreeze(this._nodes);

    }

    private addNode(node: Node) {
        this._nodes.push(node);
    }

    private getOrCreateVariable(name: string) {
        let found = this._vars.find((v) => v.name === name)
        if (!found) {
            found = new Variable(name);
            this._vars.push(found);
        }
        return found;
    }

    public get nodes() {
        return this._nodes;
    }

    public get variables() {
        return this._vars;
    }

    public substitute(mapping: VariableMapping): string {

        let result = '';

        this._nodes.forEach((node) => {

            if (node instanceof TextNode) {
                result += (node as TextNode).text;
            } else if (node instanceof VariableNode) {
                let varNode = (node as VariableNode);
                let m = mapping.mapping[varNode.variable.name];
                if (!m) {
                    throw new Error("No mapping found for ${" + varNode.variable.name + "}");
                }

                if (typeof m === 'function') {
                    m = m();
                }

                if (varNode.transform) {
                    m = varNode.transform(m)
                }

                result += m;
            } else {
                throw Error("Unknown node type: " + node);
            }

        });


        return result;

    }

}

export interface VariableMapping {
    mapping: Record<string, StringProvider>
}


export class Node {

}

export class TextNode extends Node {

    private readonly _text: string

    constructor(text: string) {
        super()
        this._text = text
    }

    public get text(): string {
        return this._text;
    }

}

export class VariableNode extends Node {

    private readonly _variable: Variable
    private readonly _transform: StringTransformer;

    constructor(variable: Variable, transform: StringTransformer = null) {
        super()
        this._variable = variable;
        this._transform = transform;
    }

    public get variable() {
        return this._variable;
    }

    public get transform(): StringTransformer {
        return this._transform
    }

}

export class Variable {

    private readonly _name: string;
    private _nodes: VariableNode[] = []

    constructor(name: string) {
        this._name = name;
    }

    public addNode(node: VariableNode) {
        this._nodes.push(node)
    }

    public removeNode(node: VariableNode) {

        let idx = this._nodes.indexOf(node)
        if (idx >= 0) {
            this._nodes.splice(idx, 1)
        }

    }

    public get name(): string {
        return this._name;
    }

    public get nodes(): VariableNode[] {
        return this._nodes;
    }

    usageCount(): number {
        return this._nodes.length;
    }

}