const { parse, loadFile } = require('./gen.js')
const fs = require('fs');

const classDef = './lua-doc-gen/classDef.html'

function saveFile(path, data) {
    fs.writeFileSync(path, data)
}

function varToHtml(variable) {
    return `<code><code class=var>${variable.name}</code>: <code class=type>${variable.type}</code></code>`
}

function varToHtmlTable(variable) {
    var html = `<tr><td><code class=type>${variable.type}</code></td><td><code class=var>${variable.name}</code></td><td>`
    if (variable.vis != 'public') {
        html += `<span class=vis>${variable.vis}. </span>`
    }
    return html += `${variable.desc}</td></tr>`
}
function varToHtmlDb(variable) {
    html = `<div class="datablock" id=${variable.name}><h3>${varToHtml(variable)}</h3>`
    if (variable.vis != 'public') {
        html += `<span class=vis>${variable.vis}</span><br/>`
    }
    html += `${variable.desc}`
    if (variable.val != '') {
        html += `<br/>Default value: <code>${variable.val}</code>`
    }
    return html + '</div>'
}

function htmlFuncSig(func) {
    html = `<code><code class=func>${func.name}(</code>`
    for (let index = 0; index < func.args.length; index++) {
        const element = func.args[index];
        if (!element || element.name == '') break;
        if (index > 0) html += ', '
        html += varToHtml(element)
    }
    return html + '<code class=func>)</code></code>'
}

function funcToHtmlTable(func) {
    var retTypes = func.getRetTypes()
    var html = `<tr><td>`
    if (retTypes.length > 0) {
        for (let index = 0; index < retTypes.length; index++) {
            const ret = retTypes[index];
            if (index > 0) html += ', '
            html += `<code class=type>${ret}</code>`
        }
    } else {
        html += '<code class=nil>nil</code>'
    }
    html += `</td><td>${htmlFuncSig(func)}</td>`
    html += `<td>${func.desc}</td>`
    return html + '</tr>'
}

function funcToHtmlDb(func) {
    s = `<div class="datablock" id=${func.name}>`
    s += `<h3>${htmlFuncSig(func)}</h3>`
    s += func.desc.join('<br/>')
    if (func.args.length > 0 && func.args[0].name != '') {
        s += "<br/><u>Arguments</u><br/>"
        for (let i = 0; i < func.args.length; i++) {
            const arg = func.args[i];
            if (i > 0) s += '<br/>'
            s += varToHtml(arg)
            if (arg.desc != '') s += ` - ${arg.desc}`
        }
    }
    if (func.ret.length > 0 && func.ret[0].name != '') {
        s += "<br/><u>Returns</u><br/>"
        for (let i = 0; i < func.ret.length; i++) {
            const ret = func.ret[i];
            if (i > 0) s += '<br/>'
            s += varToHtml(ret)
            if (ret.desc != '') s += ` - ${ret.desc}`
        }
    }
    return s + "</div>"
}

function classToHTML(data) {
    var html = loadFile(classDef)
    // console.log(html)
    // data.forEach(element => {
    //     console.log(element)
    // });
    Object.keys(data[0]).forEach((k) => {
        c = data[0][k];
        html = html.replaceAll('%ClassName%', c.name)
        var desc = c.desc.join('<br/>')
        if (c.parent != '') {
            desc = `<h4>Inherits from <code class=type>${c.parent}</code></h4>` + desc
        }
        html = html.replaceAll('%ClassDesc%', desc)
        
        var vars = ''
        var varDbs = ''
        c.vars.forEach((k) => {
            vars += varToHtmlTable(k)
            varDbs += varToHtmlDb(k)
        });
        html = html.replaceAll('%TableVariables%', vars)
        html = html.replaceAll('%Variables%', varDbs)
        
        var funcs = ''
        var funcDbs = ''
        var instFuncs = ''
        var instFuncDbs = ''
        c.funcs.forEach((k) => {
            if (k.type == 'instance') {
                instFuncs += funcToHtmlTable(k)
                instFuncDbs += funcToHtmlDb(k)
            } else {
                funcs += funcToHtmlTable(k)
                funcDbs += funcToHtmlDb(k)
            }
        });
        html = html.replaceAll('%TableFunctions%', funcs)
        html = html.replaceAll('%Functions%', funcDbs)
        html = html.replaceAll('%TableInstanceFunctions%', instFuncs)
        html = html.replaceAll('%InstanceFunctions%', instFuncDbs)
    });
    // console.log(html)
    return html
}

var windowData = parse(loadFile('./pOS/os/gui/Window.lua'))
// console.log(windowData)
saveFile('./lua-doc-gen/output.html', classToHTML(windowData))