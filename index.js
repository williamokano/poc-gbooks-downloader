const { Builder, By, Key, until } = require('selenium-webdriver')
const urlParse = require('url-parse')
const querystring = require('querystring')

Array.prototype.pmap = async function (callback) {
    return Promise.all(this.map(callback))
}

Array.prototype.pfilter = async function (callback) {
    return Promise.all(this.filter(callback))
}

async function downloadBook(url) {
    const { query } = urlParse(url)
    const { id: bookId } = querystring.decode(query.substring(1))

    console.log(`Downloading pages for bookId: ${bookId}`)

    let driver = await new Builder().forBrowser('chrome').build();

    try {
        await driver.get(url);

        const { nextPageButton } = await getNavigationButtons(driver)

        let oldPage = undefined
        let currentPage = await getCurrentPage(driver)
        const allPages = new Set()

        // while (oldPage !== currentPage) {

        console.log(`Fetching for page ${currentPage}`)
        // Update old page
        oldPage = currentPage

        // Get images to be downloaded
        const allImages = await driver.findElements(By.tagName('img'))

        const imagesUrl = await allImages.pmap(img => img.getAttribute("src"))
        const bookImages = imagesUrl.filter(url => url.includes(bookId))
        bookImages.forEach(url => {
            allPages.add(url)
            console.log(`Page found: ${url}`)
        })
        console.log(`Total unique pages: ${allPages.size}`)

        // Move 3 pages ahead
        await nextPageButton.click()
        await nextPageButton.click()
        await nextPageButton.click()
        currentPage = await getCurrentPage(driver)

        await driver.sleep(2000)

        // }

        console.log('No more pages to be found...')
        console.log('Preparing for download')
        // Download all images
        const parsedObjectsToDownload = parseToDownloadObject(allPages)
        console.log(parsedObjectsToDownload)

        console.log('Download complete')
        await driver.sleep(1000)
    } finally {
        await driver.sleep(3000)
        await driver.quit();
    }
}

function buildDownloadUrl(originalUrl, newQueryString) {
    return `${originalUrl.substring(0, originalUrl.indexOf('?'))}?${querystring.encode(newQueryString)}`
}

function applyNumberPadding(anyString) {
    if (anyString.match(/\d/)) {
        return anyString.replace(/(\d+)/g, (_, b) => b.padStart(5, '0'))
    }

    return anyString
}

function parseToDownloadObject(set) {
    return [...set].map(url => {
        const { query } = urlParse(url)
        const decodedQueryString = querystring.decode(query.substring(1))

        // Change width to 2560
        decodedQueryString['w'] = 2560

        return {
            pageName: applyNumberPadding(decodedQueryString['pg'] || '0_COVER'),
            downloadUrl: buildDownloadUrl(url, decodedQueryString)
        }
    })
}

async function getCurrentPage(driver) {
    const { pageButton } = await getNavigationButtons(driver)
    const pageSpanElement = await pageButton.findElement(By.tagName('span'))

    return await pageSpanElement.getText()
}

async function getNavigationButtons(driver) {
    const { pageId, previousId, nextId } = await getButtonsSelectors(driver)
    await driver.wait(until.elementLocated(By.id(nextId)))
    try {
        const pageButton = await driver.findElement(By.id(pageId))
        const previousPageButton = await driver.findElement(By.id(previousId))
        const nextPageButton = await driver.findElement(By.id(nextId))

        return { pageButton, previousPageButton, nextPageButton }
    } catch (e) {
        console.error(e)
    }
}

async function getButtonsSelectors(driver) {
    const rightToolbox = await driver.findElement(By.css('#right-toolbar-buttons > div'))
    const buttons = await rightToolbox.findElements(By.css('div[role=button]'))
    const buttonsIds = await buttons.pmap(element => element.getAttribute("id"))
    const fields = ['pageId', 'previousId', 'nextId'];
    return Object.fromEntries(fields.map((_, i) => [fields[i], buttonsIds[i]]))
}

downloadBook('https://books.google.co.jp/books?id=WoFIAgAAQBAJ&printsec=frontcover&dq=isbn:9784384057522&hl=&cd=1&source=gbs_api#v=onepage&q&f=true')
/*
(async function example() {
    let driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get('https://books.google.co.jp/books?id=WoFIAgAAQBAJ&printsec=frontcover&dq=isbn:9784384057522&hl=&cd=1&source=gbs_api#v=onepage&q&f=true');
        const images = await driver.findElements(By.css('img'))
        const urlPromises = images.map(webElement => webElement.getAttribute("src"))
        const urls = await Promise.all(urlPromises)
        console.log(urls)
    } finally {
        await driver.quit();
    }
})();
*/
