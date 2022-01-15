// ==UserScript==
// @name         Filter by topic
// @namespace    https://github.com/foamzou/group-by-repo-on-github/filter-by-topic
// @version      0.1
// @description  Add the topic options to filter repp
// @author       foamzou
// @match        https://github.com/orgs/AfterShip/repositories*
// @grant        none
// ==/UserScript==
const TopicList = ["All", "mocha", "maotai", "yorsh"]; // cannot remove the first `All`

const debug = false;
const l = m => {
    debug && console.log(m);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TopicOptionBtnId = 'topic-options';

// global var
let lastQueryStr = getQuery().queryStr;
let backupHtml = '';

async function detectQueryChanged() {
    let retryCount = 0;
    while (true) {
        let q = getQuery();
        if (q.queryStr !== lastQueryStr) {
            lastQueryStr = q.queryStr;
            return true;
        }
        if (retryCount > 500) {
            return false;
        }
        retryCount++;
        await sleep(20);
    }
}

async function tryInit() {
    l('try init')
    if (await detectQueryChanged()) {
        init();
    } else {
        l('no changed');
    }
}

document.addEventListener('change', async function() {
    l('trigger by event listener change')
    tryInit();
});

(function(history){
    const pushState = history.pushState;
    history.pushState = function(state) {
        if (typeof history.onpushstate == "function") {
            history.onpushstate({state: state});
        }
        const ret = pushState.apply(history, arguments);
        l('trigger by history push')
        tryInit();
        return ret;
    }
})(window.history);

(function() {
    'use strict';
    init(true);
})();

// Firefox和Chrome早期版本中带有前缀


var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver
// 选择目标节点
var target = document.getElementById('org-repositories')//document.querySelector('#some-id');
// 创建观察者对象
var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        l('dom changed')
        if (!document.getElementById('topic_All').checked && backupHtml != "" && document.getElementById('org-repositories').innerHTML != backupHtml) {
            l('IN 列表中子元素被修改');
            document.getElementById('org-repositories').innerHTML = backupHtml
        }
    });
});
// 配置观察选项:
var config = { attributes: true, childList: true, characterData: true }
// 传入目标节点和观察选项
observer.observe(target, config);


async function init(isFirst = false) {
    l('start init');
    const q = getQuery();
    if (q.topic && isFirst) {
        l('loading')
        document.getElementsByClassName('org-repos repo-list')[0].innerHTML = "Loading...."
    }
    createOrUpdateTopicOption();
    listRepo(q)
}

async function listRepo(q) {
    let sort = '';
    let kw = '';
    let lang = '';
    let page = '';
    if (!q.topic) {
        l('no need load repo')
        return;
    }

    if (q.keyword) {
        kw = `${q.keyword}%3A`
    }
    if (q.lang) {
        lang = `&l=${q.lang}`
    }
    if (q.page) {
        page = `&p=${q.page}`
    }
    if (q.sort == "") {
        sort = '&o=desc&s=updated'
    } else if (q.sort == "name") {
        sort = '&s='
    } else {
        sort = '&o=desc&s=stars'
    }
    const url = `https://github.com/search?q=${kw}org%3A${q.org}+topic%3A${q.topic}&type=Repositories${lang}${sort}${page}`;

    l(url)

    const repoHtmlRes = await fetch(url);
    const repoHtmlStr = await repoHtmlRes.text();
    const repoHtmlGroup = repoHtmlStr.match(/<ul class="repo-list">[\s\S]+?<\/ul>/);
    if (!repoHtmlGroup) {
        l('no result');
        document.getElementsByClassName('org-repos repo-list')[0].innerHTML = "No result"
        return;
    }

    const pageGroup = repoHtmlStr.match(/<div class="paginate-container[\s\S]+?<\/div>[\s\S]+?<\/div>/);
    let repoListHtml = repoHtmlGroup[0];
    const topicUrl = `https://github.com/orgs/${q.org}/repositories?topic=`;
    const matchPageHrefs = repoListHtml.match(/href="\/topics\/(.+?)"/g);

    matchPageHrefs.map( href => {
        const topic = href.match(/topics\/(.+?)"/)[1];
        repoListHtml = repoListHtml.replace(href, `href="${topicUrl}${topic}"`);
    })


    let pageHtml = '';
    if (pageGroup && pageGroup[0]) {
        pageHtml = pageGroup[0];

        const currentUrl = document.URL.replace(/&p=[\d]+/, '');
        const matchPageHrefs = pageHtml.match(/href="(.+?)"/g);

        matchPageHrefs.map( href => {
            const p = href.match(/p=([\d]+)/)[1];
            pageHtml = pageHtml.replace(href, `href="${currentUrl}&p=${p}"`);
        })
    }
    const hackHtml = `${repoListHtml} ${pageHtml}`;
    backupHtml = '';
    document.getElementsByClassName('org-repos repo-list')[0].innerHTML = hackHtml;
    backupHtml = document.getElementById('org-repositories').innerHTML
}


function getQuery() {
    const currentPageUrl = document.URL;
    const url = new URL(currentPageUrl);
    const lang = url.searchParams.get("language");
    const sort = url.searchParams.get("sort");
    const topic = url.searchParams.get("topic");
    const keyword = url.searchParams.get("q");
    const page = url.searchParams.get("p");
    const org = document.URL.match(/orgs\/(.+?)\/repositories/)[1];
    return {
        lang,
        sort,
        topic,
        keyword,
        org,
        page,
        queryStr: `${org}-${keyword}-${lang}-${sort}-${topic}-${page}`
    };
}

function createOrUpdateTopicOption() {
    let node = document.getElementById(TopicOptionBtnId);
    if (!node) {
        node = document.createElement('details');
        node.id = TopicOptionBtnId;
        node.className = 'details-reset details-overlay position-relative mt-1 mt-lg-0 ml-2';
        document.getElementById('sort-options').parentNode.appendChild(node)
    } else {
        l('have created btn, skip');
    }
    const q = getQuery();
    const buildTopicHtml = (topicName) => {
        const topicValue = topicName === 'All' ? '' : topicName;
        const isSelect = q.topic == topicValue;
        return `
         <label class="SelectMenu-item" role="menuitemradio" aria-checked="${isSelect ? 'true' : 'false'}" tabindex="0">
            <input type="radio" name="topic" id="topic_${topicName}" value="${topicValue}" hidden="hidden" data-autosubmit="true" ${isSelect ? `checked="checked"` : ""}>
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
               <path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
            </svg>
            <span class="text-normal" data-menu-button-text="">${topicName}</span>
         </label>
         `;
    }


    const topicHtml = TopicList.map(name => buildTopicHtml(name)).join('');

    node.innerHTML = `
           <summary aria-haspopup="menu" data-view-component="true" class="btn" role="button">  <span>Topic</span>
   <span class="d-none" data-menu-button="">
   Name
   </span>
   <span class="dropdown-caret"></span>
</summary>
<details-menu class="SelectMenu left-md-0 left-lg-auto right-md-auto right-lg-0" role="menu">
   <div class="SelectMenu-modal">
      <header class="SelectMenu-header">
         <span class="SelectMenu-title">Select topic</span>
         <button class="SelectMenu-closeButton" type="button" data-toggle-for="topic-options">
            <svg aria-label="Close menu" aria-hidden="false" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
               <path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"></path>
            </svg>
         </button>
      </header>
      <div class="SelectMenu-list">
         ${topicHtml}
      </div>
   </div>
</details-menu>
    `;

}




