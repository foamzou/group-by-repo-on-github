// ==UserScript==
// @name         Group by repo on github
// @namespace    https://github.com/foamzou/group-by-repo-on-github
// @version      0.2.0
// @description  When you search code using github, this script can help you group by repo
// @author       foamzou
// @match        https://github.com/search?q=*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/foamzou/group-by-repo-on-github/main/index.js
// @downloadURL  https://raw.githubusercontent.com/foamzou/group-by-repo-on-github/main/index.js
// ==/UserScript==
let pageCount = 0;
const ContentTableUlNodeId = 'contentTableUl';
const BtnGroupById = 'btnGroupBy';

let shouldLoading = true;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debug = false;

(function() {
    'use strict';
    tryInit();
})();

function isSupportThePage() {
    if (document.location.search.match(/type=code/)) {
        return true;
    }
    l(`not support ${document.location}`);
    return false;
}

// for apply the script while url change
(function(history){
    const pushState = history.pushState;
    history.pushState = function(state) {
        if (typeof history.onpushstate == "function") {
            history.onpushstate({state: state});
        }
        const ret = pushState.apply(history, arguments);
        tryInit();
        return ret;
    }
})(window.history);

async function tryInit() {
    l('tryInit');
    if (!isSupportThePage()) {
        return;
    }
    if ((await tryWaitEle()) === false) {
        l('wait ele failed, do not setup init UI');
        return;
    }
    pageCount = getPageTotalCount();
    l(`total count: ${pageCount}`)
    initUI();
}

async function tryWaitEle() {
    const MAX_RETRY_COUNT = 20;
    let retry = 0;
    while (true) {
        if (document.getElementsByClassName("pagination") && document.body.innerText.match(/code result/)) {
            l('find ele');
            return true;
        }
        l('ele not found, wait a while');
        if (++retry > MAX_RETRY_COUNT) {
            return false;
        }
        await sleep(1000);
    }
}

function initUI() {
    if (document.getElementById(BtnGroupById)) {
        l('have created btn, skip');
        return;
    }
    const createBtn = () => {
        const btnNode = document.createElement('button');
        btnNode.id = BtnGroupById;
        btnNode.className = 'text-center btn btn-primary ml-3';
        btnNode.setAttribute('style', 'padding: 3px 12px;');
        btnNode.innerHTML = 'Start Group By Repo';

        const menuNode = document.querySelector('.select-menu');
        const parentNode = menuNode.parentNode;
        parentNode.insertBefore(btnNode, menuNode);
    }
    createBtn();
    document.getElementById(BtnGroupById).addEventListener("click", startGroupByRepo);

}


function startGroupByRepo() {
    const initNewPage = () => {
        document.querySelector('.container-lg').style='max-width: 100%';

        const resultNode = document.querySelector('.codesearch-results');
        resultNode.className = resultNode.className.replace('col-md-9', 'col-md-7');

        const leftMenuNode = resultNode.previousElementSibling;
        leftMenuNode.className = leftMenuNode.className.replace('col-md-3', 'col-md-2');

        // create content table node
        const contentTableNode = document.createElement('div');
        contentTableNode.id = 'contentTableNode';
        contentTableNode.className = 'col-12 col-md-3 float-left px-2 pt-3 pt-md-0';
        contentTableNode.setAttribute('style', 'position: fixed; right:1em; top: 62px; border-radius: 15px; background: #f9f9f9 none repeat scroll 0 0; border: 1px solid #aaa; display: table; margin-bottom: 1em; padding: 20px;');

        // tool box
        const toolBoxNode = document.createElement('div');
        toolBoxNode.id = 'toolBoxNode';
        toolBoxNode.innerHTML = `
            <div style="height: 30px;">
                <div id="loadTextNode" style="text-align: center;width: 200px;float:left;line-height: 30px;">Load 1/1 Page</div>
                <span id="btnAbortLoading" class="btn btn-sm" style="float:right">Abort Loading</span></div>
            <div>
            <span id="btnExpandAll" class="btn btn-sm">Expand all</span>
            <span id="btnCollapseAll" class="btn btn-sm">Collapse all</span>
            <span id="btnButtom" style="float:right;" class="btn btn-sm">Buttom</span>
            <span id="btnTop" style="float:right;" class="btn btn-sm">Top</span>
        `;


        contentTableNode.appendChild(toolBoxNode);

        const ulNode = document.createElement('ul');
        ulNode.id = ContentTableUlNodeId;
        ulNode.setAttribute('style', 'list-style: outside none none !important;margin-top:5px;overflow: scroll;height: 600px');
        contentTableNode.appendChild(ulNode);

        resultNode.parentNode.insertBefore(contentTableNode, resultNode.nextElementSibling);

        document.getElementById("btnAbortLoading").addEventListener("click", abortLoading);
        document.getElementById("btnTop").addEventListener("click", toTop);
        document.getElementById("btnButtom").addEventListener("click", toButtom);
        document.getElementById("btnExpandAll").addEventListener("click", expandAll);
        document.getElementById("btnCollapseAll").addEventListener("click", collapseAll);

        setProgressText(1, pageCount);
        removeElementsByClass('paginate-container');
        document.getElementById("btnGroupBy").remove();
    }
    initNewPage();
    groupItemList();
    removeElementsByClass('code-list');
    showMore();
}

function abortLoading() {
    shouldLoading = false;
    document.getElementById("btnAbortLoading").innerHTML = 'Aborting...';
}

function setProgressText(current, total, content = false) {
    const els = document.querySelector('#loadTextNode');
    if (content) {
        document.getElementById("btnAbortLoading").remove();
        els.setAttribute("style", "text-align: center;width: 100%;float:left;line-height: 30px;");
        els.innerHTML = `${els.innerHTML}. ${content}`;
    } else {
        els.innerHTML = `Load ${current}/${total} Page`;
    }
}

function toTop() {
    window.scrollTo(0, 0);
}
function toButtom() {
    window.scrollTo(0,document.body.scrollHeight);
}
function expandAll() {
    const els = document.querySelectorAll('.details-node');
    for (let i=0; i < els.length; i++) {
        els[i].setAttribute("open", "");
    }
}
function collapseAll() {
    const els = document.querySelectorAll('.details-node');
    for (let i=0; i < els.length; i++) {
        els[i].removeAttribute("open");
    }
}

function makeValidFlagName(name) {
    return name.replace(/\//g, '-').replace(/\./g, '-');
}

function getRepoAnchorId(repoName) {
    return `anchor-id-${makeValidFlagName(repoName)}`;
}

function updateContentTableItem(repoName, fileCount) {
    const liNodeId = `contentTableNodeLi-${makeValidFlagName(repoName)}`;
    const fileCounterSpanNodeId = `fileCounterSpanNodeId-${makeValidFlagName(repoName)}`;
    const createLiNodeIfNotExist = () => {
        let liNode = document.querySelector(`#${liNodeId}`);
        if (liNode != null) {
            return;
        }
        liNode = document.createElement('li');
        liNode.id = liNodeId;

        const aNode = document.createElement('a');
        aNode.href = `#${getRepoAnchorId(repoName)}`;
        aNode.innerHTML = repoName;

        const infoNode = document.createElement('div');

        const fileCounterSpanNode = document.createElement('span');
        fileCounterSpanNode.id = fileCounterSpanNodeId;
        fileCounterSpanNode.setAttribute('style', 'width:50px;display:inline-block');
        fileCounterSpanNode.innerHTML = '📃 0';

        const starCounterNode = document.createElement("span");
        starCounterNode.setAttribute('style', 'padding-left:5px;width:80px;display:inline-block');
        starCounterNode.textContent = '⭐ ?';

        const langNode = document.createElement("span");
        langNode.setAttribute('style', 'padding-left:5px;width:100px;display:inline-block');

        // async fetch repo info
        getRepoInfo(repoName).then(info => {
            l(info);
            const langIcon = getLangIcon(info.language);
            langNode.innerHTML = langIcon ? `<img alt="${info.language}" src="${langIcon}" style="width: 15px;"> ${info.language}` : info.language;
            starCounterNode.textContent = `⭐ ${info ? info.stars : '?'} `;
        });

        infoNode.appendChild(fileCounterSpanNode);
        infoNode.appendChild(starCounterNode);
        infoNode.appendChild(langNode);

        const hrNode = document.createElement("hr");
        hrNode.setAttribute('style', 'margin:2px;');

        liNode.appendChild(aNode);
        liNode.appendChild(infoNode);
        liNode.appendChild(hrNode);

        const ulNode = document.querySelector(`#${ContentTableUlNodeId}`);
        ulNode.appendChild(liNode);
    };

    const updateFileCount = () => {
        const fileCounterSpanNode = document.querySelector(`#${fileCounterSpanNodeId}`);
        fileCounterSpanNode.innerHTML = `📃 ${fileCount} `;
    };

    createLiNodeIfNotExist();
    updateFileCount();
}

async function showMore() {
    if (pageCount <= 1) return;
    for (let i = 2; i<= pageCount; ++i) {
        if (!shouldLoading) {
            setProgressText(0, 0, 'Load Aborted Now');
            break;
        }
        l(`load page ${i} ... `)
        await fetchAndParse(i);
        setProgressText(i, pageCount);
        await sleep(1000);
    }
    setProgressText(0, 0, 'Load Finished')
}

async function fetchAndParse(pageNum) {
    const url = `${window.location.href}&p=${pageNum}`;
    let response;
    while (true) {
        response = await fetch(url);
        if (response.status == 429) {
            l(`429 limit, wait 2s ...`);
            await sleep(2000);
            continue;
        }
        break;
    }
    const htmlText = await response.text();

    const tempNode = document.createElement("div");
    tempNode.className = "temp-node-class";
    tempNode.innerHTML = htmlText;
    document.getElementsByClassName('codesearch-results')[0].appendChild(tempNode);

    groupItemList();
    removeElementsByClass(tempNode.className);
}

function getPageTotalCount() {
    const totalPageList = document.getElementsByClassName("pagination")[0].querySelectorAll("a");
    return parseInt(totalPageList[totalPageList.length -2].innerText)
}

function groupItemList() {
    const list = [... document.getElementsByClassName("code-list")[0].querySelectorAll(".code-list-item")];
    list.map(item => {
        const ele = parseCodeItem(item)
        addCodeEle(ele)
    });
}

function parseCodeItem(ele) {
    const _ele = ele.cloneNode(true);
    const repoName = _ele.querySelector('.Link--secondary').innerHTML.trim();
    const repoNode = _ele.querySelector('div.flex-shrink-0 a').cloneNode(true);
    _ele.querySelector('.width-full').removeChild(_ele.querySelector('div.flex-shrink-0'));

    return {
        repoName,
        repoNode,
        iconNode: _ele.querySelector("img"),
        codeItemNode: _ele.querySelector('.width-full')
    };
}

function addCodeEle(ele) {
    const fileCounterId = `fileCounterNode-${ele.repoName}`;
    const getDetailsNode = (repoName) => {
        const detailsNodeId = getRepoAnchorId(ele.repoName);
        const detailsNode = document.getElementById(detailsNodeId);
        if (detailsNode != null) {
            return detailsNode;
        }
        const node = document.createElement("details");
        node.id = detailsNodeId;
        node.className = "hx_hit-code code-list-item d-flex py-4 code-list-item-private details-node";
        node.setAttribute('open', '');

        const fileCounterNode = document.createElement("span");
        fileCounterNode.setAttribute('style', 'font-size:15px; padding: 1px 5px 1px 5px;border-radius:10px;background-color: #715ce4;color:  white;margin-left: 10px;');
        fileCounterNode.textContent = '0 files';
        fileCounterNode.id = fileCounterId;

        const summaryNode = document.createElement("summary");
        summaryNode.setAttribute('style', 'font-size: large;');
        summaryNode.appendChild(ele.iconNode);
        summaryNode.appendChild(ele.repoNode);
        summaryNode.appendChild(fileCounterNode);

        node.appendChild(summaryNode);
        document.getElementById("code_search_results").appendChild(node);
        return node;
    };

    const updateFileCount = () => {
        const node = document.getElementById(fileCounterId);
        const t = node.textContent;
        const fileCount = parseInt(t.replace('files', '')) + 1;
        node.textContent = `${fileCount} files`;

        updateContentTableItem(ele.repoName, fileCount);
    }

    getDetailsNode(ele.repoName).appendChild(ele.codeItemNode);
    updateFileCount();

}

async function getRepoInfo(repoName) {
    let info = await getRepoInfoByApi(repoName);
    if (info) {
        return info;
    }
    // coz api limit, try from html
    return await getRepoInfoByFetchHtml(repoName);
}

async function getRepoInfoByApi(repoName) {
    try {
        l(`try to getRepoInfoByApi: ${repoName}`)
        const response = await fetch(`https://api.github.com/repos/${repoName}`)
        const data = await response.json();
        if (data.stargazers_count === undefined) {
            return false;
        }
        return {
            stars: data.stargazers_count,
            watch: data.watchers_count,
            fork: data.forks_count,
            language: data.language
        };
    } catch (e) {
        l(e);
    }
    return false;
}

async function getRepoInfoByFetchHtml(repoName) {
    try {
        l(`try to getRepoInfoByFetchHtml: ${repoName}`)
        const response = await fetch(`https://github.com/${repoName}`)
        const data = await response.text();
        const stars = data.match(/"(.+?) users starred this repository"/)[1];
        // ignore error when these optional field not parsed succefuly
        let watch, fork, language;
        try {
            watch = data.match(/"(.+?) user.+ watching this repository"/)[1];
            fork = data.match(/"(.+?) user.+forked this repository"/)[1];
            language = data.match(/Languages[\s\S]+?color-text-primary text-bold mr-1">(.+?)<\/span>/)[1];
        } catch(e) {
            l(e);
        }
        return {
            stars,
            watch,
            fork,
            language
        };
    } catch (e) {
        l(e);
    }
    return false;
}

function getLangIcon(lang) {
    if (!lang) {
        return false;
    }
    lang = lang.toLowerCase();
    const config = {
        javascript: 'js',
        python: 'python',
        java: 'java',
        go: 'golang',
        ruby: 'ruby',
        typescript: 'ts',
        'c++': 'cpp',
        php: 'php',
        'c#': 'csharp',
        c: 'c',
        shell: 'shell',
        dart: 'dart',
        rust: 'rust',
        kotlin: 'kotlin',
        swift: 'swift',
    };
    return config[lang] ? `https://raw.githubusercontent.com/foamzou/group-by-repo-on-github/main/lang-icon/${config[lang]}.png` : false;
}


function removeElementsByClass(className){
    const elements = document.getElementsByClassName(className);
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }
}

function l(msg) {
    debug && console.log(msg)
}


