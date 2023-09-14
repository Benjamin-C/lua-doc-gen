import re
import requests
from tqdm import tqdm
import sys

# fn = "https://peter.crall.family/minecraft/cc/pos/os/gui/Window.lua"
fn = "Window.lua"
if len(sys.argv) > 1:
    fn = sys.argv[1]
print("Reading", fn)
lines = []
if fn.startswith("http"):
    response = requests.get(fn)
    lines = [re.sub("^\s*", "", line) for line in str(response.text).split("\n")]
else:
    with open('Window.lua') as file:
        for line in file:
            lines.append(re.sub("^\s*", "", line[:-1]))

classname = ""
classdesc = ""
funcs = []
vars = []

def htmlType(type, nonil=False):
    if not nonil and (type == "nil" or type == "any"):
        return htmlNil(type)
    return f'<code class="type">{type}</code>'
def htmlVar(var):
    return f'<code class="var">{var}</code>'
def htmlNil(type="nil"):
    return f'<code class="nil">{type}</code>'

class Function():
    def __init__(self):
        self.name = ""
        self.type = ""
        self.desc = []
        self.args = []
        self.ret = []
    
    def __str__(self):
        s = f"{self.type:>8s} {self.name} ({', '.join([str(a) for a in self.args])})"
        for r in self.ret:
            s += f"\n -> {r}"
        for d in self.desc:
            s += f"\n{d}"
        return s
    
    def htmlSig(self):
        return f'<code class="func">{self.name}({", ".join([a.htmlSig() for a in self.args])})</code>'

    def htmlSummaryTableRow(self):
        s = f'<tr>\n<td>'
        if len(self.ret) > 0:
            s += ', '.join([htmlType(r.type) for r in self.ret])
        else:
            s+= htmlNil()
        s += '</td>\n'
        s += f'<td>{self.htmlSig()}</td>\n'
        s += f'<td>{"<br>".join(self.desc)}</td>\n'
        return s + '</tr>\n'

    def htmlDetailBlock(self):
        s = f'<div class="datablock" id={self.name}>'
        s += f'<h3>{self.htmlSig()}</h3>'
        s += f'{"<br/>".join(self.desc)}'
        if len(self.args) > 0:
            s += "<br/><u>Args</u><br/>"
            s += "<br/>".join([f"{htmlVar(arg.name)}: {htmlType(arg.type)} {'- ' if len(arg.desc) > 0 else ''}{arg.desc}" for arg in self.args])
        if len(self.ret) > 0:
            s += "<br/><u>Returns</u><br/>"
            s += "<br/>".join([f"{htmlVar(r.name)}: {htmlType(r.type)} {'- ' if len(r.desc) > 0 else ''}{r.desc}" for r in self.ret])
        return s + "</div>"

class Variable():
    def __init__(self, name="", type="", desc="", val=""):
        self.name = name
        self.type = type
        self.desc = desc
        self.val = val

    def __str__(self):
        return f"{self.name}{'=' if len(self.val)>0 else ''}{self.val}: {self.type}; {self.desc}"
    
    def htmlSig(self):
        return htmlVar(self.name)+": "+htmlType(self.type)
    
    def htmlSummaryTableRow(self):
        return f'<tr><td>{htmlType(self.type)}</td><td>{htmlVar(self.name)}</td><td>{self.desc}</td></tr>'
    
    def htmlDetailBlock(self):
        return f'<div class="datablock" id={self.name}><h3>{self.htmlSig()}</h3>{self.desc}<br/>Default: {self.val}</div>'

class Argument(Variable):
    pass

def split(regex, str):
    s = re.search(regex, str)
    if s is not None:
        sp = s.span()
        return [str[:sp[0]], str[sp[1]:]]
    else:
        return [str, ""]

print("Parsing ...")
for i in range(len(lines)):
    l = lines[i]
    if l.startswith('---@class '):
        classname = l.split(" ")[1]
        classdesc = " ".join(l.split(" ")[2:])
        for j in range(i, len(lines)):
            l = lines[j]
            if len(l) > 0:
                if l.startswith('---'):
                    if l.startswith('---@field'):
                        v = Variable()
                        l = split("---@field\s*", l)[1]
                        s = split("\s+", l)
                        v.name = s[0]
                        s = split("\s+", s[1])
                        v.type = s[0]
                        v.desc = s[1]
                        vars.append(v)
                else:
                    break
    elif classname != "" and l.startswith('local ' + classname):
        for j in range(i+1, len(lines)):
            l = lines[j]
            if l.startswith("}"):
                break
            if len(l) > 0:
                v = Variable()
                s = split("\s*=\s*", l)
                v.name = s[0]
                s = split("\s*---\s*", s[1])
                v.val = s[0].replace(",", "")
                v.type = "any"
                v.desc = s[1]
                for var in vars:
                    if var.name == v.name:
                        var.val = v.val
                        v = None
                        break
                if v is not None:
                    vars.append(v)
    elif l.startswith("function"):
        f = Function()
        # get the function signature
        f.name = l[9:].split("(")[0]
        f.type = "func"
        if(f.name.startswith(classname)):
            f.type = "instance" if f.name[len(classname)] == ":" else "static"
            f.name = f.name[len(classname)+1:]
        for arg in re.search("\(.*\)", l)[0][1:-1].split(","):
            if len(arg) > 0:
                arg = split('^\s*', arg)[1]
                f.args.append(Argument(arg))
        # Find top of doc comment
        topline = i
        for j in range(i-1, 0, -1):
            if len(lines[j]) > 0:
                if not lines[j].startswith("---"):
                    topline = j+1
                    break
        if topline < i:
            for j in range(topline, i):
                l = lines[j]
                # print(l)
                if len(l) > 0:
                    if not l.startswith("---"):
                        print("EXPLOSION!", j, l)
                        exit()
                    l = split("^---\s*", l)[1]
                    if l[0] == "@":
                        if l.startswith("@param"):
                            sp = split("\s+", split("@param\s+", l)[1])
                            an = sp[0]
                            sp = split("\s+", sp[1])
                            at = sp[0]
                            ad = sp[1]
                            for a in f.args:
                                if a.name == an:
                                    a.type = at
                                    a.desc = ad
                                    break
                        elif l.startswith("@return"):
                            sp = split("\s+", split("@return\s+", l)[1])
                            rt = sp[0]
                            sp = split("\s+", sp[1])
                            rn = sp[0]
                            rd = sp[1]
                            r = Variable(rn, rt, rd)
                            f.ret.append(r)
                    else:
                        # print("De")
                        f.desc.append(l)
            
        funcs.append(f)

def plural(num, str):
    if num != 0:
        return f'{num} {str}'
    else:
        return f'{num} {str}s'

print(f"Found {plural(len(vars), 'variables')} and {plural(len(funcs), 'functions')}")

print("Downloading template")
response = requests.get("https://peter.crall.family/minecraft/cc/doc/classDef.html")
html = str(response.text)

import platform
if platform.node != "cheddarserver":
    html = html.replace('<link rel="stylesheet" href="/', '<link rel="stylesheet" href="https://peter.crall.family/')

html = html.replace("%ClassName%", classname)
html = html.replace("%ClassDesc%", classdesc)

print("Generating")
vsp = '\n'.join([v.htmlSummaryTableRow() for v in vars if not v.name.startswith("_")])
vst = '\n'.join([v.htmlSummaryTableRow() for v in vars if v.name.startswith("_") and not v.name.startswith("__")])
vsr = '\n'.join([v.htmlSummaryTableRow() for v in vars if v.name.startswith("__")])
vdp = '\n'.join([v.htmlDetailBlock() for v in vars if not v.name.startswith("_")])
vdt = '\n'.join([v.htmlDetailBlock() for v in vars if v.name.startswith("_") and not v.name.startswith("__")])
vdr = '\n'.join([v.htmlDetailBlock() for v in vars if v.name.startswith("__")])

html = html.replace("%TableVariables%", vsp + vst + vsr)

html = html.replace("%Variables%", vdp + vdt + vdr)

tifs = ""
tnifs = ""
ifdb = ""
nifdb = ""
for f in funcs:
    if f.type == "instance":
        tifs += f.htmlSummaryTableRow()
        ifdb += f.htmlDetailBlock()
    else:
        tnifs += f.htmlSummaryTableRow()
        nifdb += f.htmlDetailBlock()

html = html.replace("%TableFunctions%", tnifs)
html = html.replace("%TableInstanceFunctions%", tifs)

html = html.replace("%InstanceFunctions%", ifdb)
html = html.replace("%Functions%", nifdb)

print("Done")
with open("output.html", "w") as hf:
    hf.write(html)
