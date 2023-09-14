import re

lines = []
with open('Window.lua') as file:
    for line in file:
        lines.append(re.sub("^\s*", "", line[:-1]))

classname = None
classdesc = None
funcs = []

class Function():
    def __init__(self):
        self.name = ""
        self.type = ""
        self.desc = []
        self.args = []
        self.ret = []
    
    def __str__(self):
        s = f"{self.type:>8s} {self.name} ({', '.join([str(a) for a in self.args])})"
        return s

class Variable():
    def __init__(self, name="", type="", desc=""):
        self.name = name
        self.type = type
        self.desc = desc

    def __str__(self):
        return f"{self.name}: {self.type}; {self.desc}"

class Argument(Variable):
    pass

def split(regex, str):
    s = re.search(regex, str)
    if s is not None:
        sp = s.span()
        return [str[:sp[0]], str[sp[1]:]]
    else:
        return [str, ""]

for i in range(len(lines)):
    l = lines[i]
    if l.startswith("function"):
        f = Function()
        # get the function signature
        f.name = l[9:].split("(")[0]
        f.type = "func"
        if(f.name.startswith(classname)):
            f.type = "instance" if f.name[len(classname)] == ":" else "static"
            f.name = f.name[len(classname)+1:]
        for arg in re.search("\(.*\)", l)[0][1:-1].split(","):
            if len(arg) > 0:
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
                print(l)
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
                    else:
                        print("De")
                        f.desc.append(l)
            
        # Get function params
        # f.args = []
        # for arg in arglist.split(","):
        #     if len(arg) > 0:
        #         arg = re.sub("^\s*", "", arg)
        #         a = Argument(name=arg)
        #         for j in range(i-1, 0, -1):
        #             sl = lines[j]
        #             if len(sl) > 0:
        #                 if not sl.startswith("---"):
        #                     break
        #                 maybe = re.search("^---\s*@param\s+" + arg + "\s+", sl)
        #                 if maybe is not None:
        #                     dl = sl[maybe.span()[1]:]
        #                     split = re.search("\s+", dl)
        #                     if split is not None:
        #                         a.type = dl[:split.span()[0]]
        #                         a.desc = dl[split.span()[1]:]
        #                     else:
        #                         a.type = dl
        #                     break
        #         f.args.append(a)
        # # Get function return
        # for j in range(i-1, 0, -1):
        #     sl = lines[j]
        #     if len(sl) > 0:
        #         ret = Variable()
        #         if not sl.startswith("---"):
        #             break
        #         maybe = re.search("^---\s*@return\s+", sl)
        #         if maybe is not None:
        #             dl = sl[maybe.span()[1]:]
        #             # ---@return type name desc
        #             split = re.search("\s+", dl)
        #             if split is not None:
        #                 a.type = dl[:split.span()[0]]
        #                 a.desc = dl[split.span()[1]:]
        #             else:
        #                 a.type = dl
        #             break
        # f.args.append(a)
                    

        funcs.append(f)
        # print(lines[i])
    elif l.startswith('---@class '):
        classname = l.split(" ")[1]
        classdesc = " ".join(l.split(" ")[2:])

print(classname)
print(classdesc)
for f in funcs:
    print(f)
print()
