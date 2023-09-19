const fs = require('fs');
const { constrainedMemory } = require('process');

/*
 * Classes to store data in
 */
function getElemByName(list, name) {
    for(let i = 0; i < list.length; i++) {
        if(list[i].name == name) {
            return list[i];
        }
    }
    return undefined;
}

class Function {
    constructor() {
        this.name = "";
        this.type = "";
        this.desc = [];
        this.args = [];
        this.ret = [];
    }

    getArg(name) {
        return getElemByName(this.args, name);
    }

    getRet(name) {
        return getElemByName(this.ret, name);
    }

    getArgNames() {
        let s = [];
        this.args.forEach((a) => {
            s.push(a.name);
        });
        return s;
    }

    getRetTypes() {
        let s = [];
        this.ret.forEach((a) => {
            s.push(a.type);
        });
        return s;
    }

    toString() {
        let s = `${(this.type.length > 0) ? this.type + ' ' : ''}${this.name}(${this.getArgNames().join(', ')}) -> ${(this.ret.length > 0) ? this.getRetTypes().join("|") : "nil"}`
        this.desc.forEach((d) => {
            s += "\n\t" + d;
        });
        this.ret.forEach((r) => {
            s += `\n\tReturns ${r.name}:${r.type}${(r.desc.length > 0) ? ': ' + r.desc : ''}`;
        });
        return s
    }
}

class Variable {
    constructor(name, type, desc, val, vis) {
        this.name = name || "";
        this.type = type || "";
        this.desc = desc || "";
        this.val = val || "";
        this.vis = vis || "public";
        // console.log(this.vis, vis)
    }

    toString() {
        return `${this.name}${(this.val.length > 0) ? '=' : ''}${this.val}: ${this.type}(${this.vis}): ${this.desc}`
    }
}

class Argument extends Variable { }

// Info about the source data file
class LuaClass {
    constructor(name, parent, desc, vars, funcs) {
        this.name = name || "";
        this.parent = parent || "";
        this.desc = desc || [];
        this.vars = vars || [];
        this.funcs = funcs || [];
        this.const = undefined
    }

    getVar(name) {
        return getElemByName(this.vars, name);
    }

    getFunc(name) {
        return getElemByName(this.funcs, name);
    }
}

/*
 * Load the source file
 */

// TODO Should probably get these from args
let sourcefilename = "Window.lua"
let templatename = "classDef.html"
let outputfilename = "output.html"

// Load the code to parse
function loadFile(path) {
    console.log("Reading")
    const data = fs.readFileSync(path, 'utf8');
    return data;
}

function parse(lua) {
    console.log("Parsing");

    lines = lua.split(/\n/);
    lines.forEach((e, i, a) => {
        a[i] = e.split(/^\s*(.*)\s*$/)[1];
    });

    let classes = [];
    let funcs = [];

    for(let linenum = 0; linenum < lines.length; linenum++) {
        l = lines[linenum];
        if(l.startsWith('---@class ')) {
            let s = l.split(/^---@class\s+([^\s:]+)(?:\s*:\s*(\S+))?\s+(.*)$/);
            c = new LuaClass(s[1], s[2], [s[3]]);
            classes.push(c);
            for(let j = linenum; j < lines.length; j++) {
                ln = lines[j]
                if(ln.length > 0) {
                    if(ln.startsWith('---')) {
                        if(ln.startsWith('---@field')) {
                            let s = ln.split(/^---@field\s+(?:(private|protected|package)\s+)?(\S*)\s+(\S*)(?:\s+(.*))?\s*$/);
                            if (s.length > 4) {
                                var variable = new Variable(s[2], s[3], s[4], undefined, s[1]);
                                c.vars.push(variable);
                            }
                        } else if(ln.startsWith('---@class')) {
                            // Already used this
                        } else {
                            c.desc.push(ln.replace(/^---\s*/, ''));
                        }
                    } else {
                        break;
                    }
                }
            }
        } else {
        let s = l.split(/^local\s+(\S+)\s*=\s*{/);
        if(s.length > 1 && getElemByName(classes, s[1]) != undefined) {
            let c = getElemByName(classes, s[1]);
            for(let j = linenum+1; j < lines.length; j++) {
                l = lines[j];
                if(l.startsWith('}')) {
                    break;
                }
                if(l.length > 0) {
                    let s = l.split(/(\S+)\s*=\s*([^,]*)/);
                    if(c.getVar(s[1]) != undefined) {
                        c.getVar(s[1]).val = s[2];
                    } else {
                        c.vars.push(new Variable(s[1], val=[2]));
                    }
                }
            }
        } else {
        let s = l.split(/^function\s+(?:(\S+):)?(\S+)\s*\((.+)?\)/);
        if(s.length > 4) {
            let f = new Function();
            f.name = s[2];
            (s[3] || "").split(/,\s+/).forEach((a) => {
                f.args.push(new Argument(a));
            });
            if(getElemByName(classes, s[1]) != undefined) {
                f.type = "instance";
                getElemByName(classes, s[1]).funcs.push(f);
            } else {
                funcs.push(f);
            }
            let topline = linenum;
            for(let j = linenum - 1; j > 0; j--) {
                if(lines[j].length > 0) {
                    if(!lines[j].startsWith('---')) {
                        topline = j+1;
                        break;
                    }
                }
            }
            if(topline < linenum) {
                for(let j = topline; j < linenum; j++) {
                    let ln = lines[j];
                    if(ln.length > 0) {
                        if(!ln.startsWith('---')) {
                            console.error(j, ln);
                            throw Error("A line should have started with dashes but didn't!");
                        }
                        if(ln.startsWith('---@param')) {
                            let s = ln.split(/^---@param\s+(?:(private|protected|package)\s+)?(\S*)\s+(\S*)(?:\s+(.*))?\s*$/)
                            if(f.getArg(s[2]) != undefined) {
                                f.getArg(s[2]).type = s[3];
                                f.getArg(s[2]).desc = s[4];
                                f.getArg(s[2]).vis = s[1];
                            } else {
                                f.args.push(new Argument(s[2], s[3], s[4], s[1]));
                            }
                        } else if(ln.startsWith('---@return')) {
                            // not sure why this be here
                            /**@todo Fix this so the name of the variable is not "return"*/
                            let s = ln.split(/^---@return\s+(\S*)\s+(\S+)(?:\s+(.*))?\s*$/)
                            f.ret.push(new Variable(s[2], s[1], s[3]));
                        } else if (ln.startsWith('---@constructor')) {
                            // Mark this as the constructor for the named class
                            let s = ln.split(/^---@constructor\s+/)
                            getElemByName(classes, s[1]).const = f
                            // funcs.pop()
                            var index = funcs.indexOf(f);
                            if (index !== -1) {
                                funcs.splice(index, 1);
                            }
                        } else {
                            f.desc.push(ln.replace(/^---\s*/, ''));
                        }
                    }
                }
            }
        }}}
    }

    return [classes, funcs]
}


// this.name = "";
// this.desc = "";
// this.vars = [];
// this.funcs = [];

const toConsole = false

if (toConsole) {
    let r = parse(loadFile(sourcefilename))

    Object.keys(r[0]).forEach((k) => {
        c = r[0][k];
        console.log("Class " + c.name);
        c.desc.forEach((d) => {
            console.log('\t' + d);
        });
        console.log("Fields:");
        c.vars.forEach((k) => {
            console.log(k.toString('\t'));
        });
        console.log("Methods:");
        c.funcs.forEach((k) => {
            console.log(k.toString('\t'));
        });
    });

    console.log("Functions");
    r[1].forEach((f) => {
        console.log(f.toString());
    });

    console.log("done");
}


// l = '---@field private x number Window X origin'
// l = '---@field protected x number Window X origin'
// l = '---@field package x number Window X origin'
// l = '---@field x number Window X origin'
// l = '---@field x number'
// // private protected package
// let s = l.split(/^---@field\s+(?:(private|protected|package)\s+)?(\S*)\s+(\S*)(?:\s+(.*))?\s*$/)
// console.log(s)

module.exports = {
    loadFile,
    parse,
    Variable,
    Argument,
    Function,
    LuaClass
}