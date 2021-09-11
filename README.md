# group-by-repo-on-github
This is the script of tampermonkey. Before using it, please make sure you have <a href="https://www.tampermonkey.net/" target="_blank">installed</a>

When you search code using github, this script can help you group by repo

## Install
Click the <a href="https://github.com/foamzou/group-by-repo-on-github/raw/main/index.user.js" target="_blank">link</a> to install

## Feature
* The script will create a button in the page, will group by repo for the search result when you click the button
    <img src="./snapshot/1-1.png" />
* The new page like the follow snapshot
    * Merged Pages: When the search results are paged, the page will be automatically fetched and updated to the current page in real time. If you do not want to continue loading new content, you can click the abort button at any time to terminate the fetch
    * List All Repo: The helper block shows all repo and info, such as stars,language
    <img src="./snapshot/1-2.png" />
