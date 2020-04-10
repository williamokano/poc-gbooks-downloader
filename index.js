const { Builder, By, until } = require('selenium-webdriver')
const urlParse = require('url-parse')
const querystring = require('querystring')
const fs = require('fs-extra')
const path = require('path')
const download = require('image-downloader')
const PDFDocument = require('pdfkit')
const argv = require('yargs')
    .usage('Usage: node $0 -u [url]')
    .example('node $0 -u https://books.google.co.jp/books?id=xpto', 'download the available pages as pdf')
    .alias('u', 'url')
    .nargs('u', 1)
    .describe('u', 'Google books book URL')
    .demandOption(['u'])
    .alias('o', 'output')
    .describe('o', 'Output dir')
    .default('o', process.cwd())
    .alias('f', 'filename')
    .describe('f', 'Output file name')
    .default('f', 'generated.pdf')
    .help('h')
    .alias('h', 'help')
    .epilog('copyright 1989')
    .argv;

Array.prototype.pmap = async function (callback) {
    return Promise.all(this.map(callback))
}

Array.prototype.pfilter = async function (callback) {
    return Promise.all(this.filter(callback))
}

function buildOutputDir() {
    const outputdir = getOutputDir()
    console.log(`Output dir: ${outputdir}`)

    if (fs.existsSync(outputdir)) {
        fs.removeSync(outputdir)
    }

    fs.mkdirSync(outputdir)
}

function getOutputDir() {
    return outputdir = path.join(process.cwd(), 'output_images')
}

async function downloadBook(url) {
    const { query } = urlParse(url)
    const { id: bookId } = querystring.decode(query.substring(1))

    console.log(`Downloading pages for bookId: ${bookId}`)
    console.log(`Current work dir: ${process.cwd()}`)
    buildOutputDir()

    let driver = await new Builder().forBrowser('chrome').build();

    try {
        await driver.get(url);

        const { nextPageButton } = await getNavigationButtons(driver)

        let oldPage = undefined
        let currentPage = await getCurrentPage(driver)
        const allPages = new Set()

        while (oldPage !== currentPage) {
            // Wait for the page to load pages
            await driver.sleep(2000)
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

        }

        console.log('No more pages to be found...')
        console.log('Preparing for download')
        // Download all images
        const destinationsPromises = parseToDownloadObject(allPages).map(page => {
            console.log(`Downloading page: ${page.pageName}`)
            const destination = `${path.join(getOutputDir(), page.pageName)}.png`
            console.log(`Saving to path: ${destination}`)

            const options = { url: page.downloadUrl, dest: destination }
            return download.image(options)
                .then(({ filename }) => console.log(`Downloaded ${filename}`))
                .then(() => destination)
        })

        const destinations = await Promise.all(destinationsPromises)
        console.log('Download complete')
        console.log('generating pdf')
        generatePdf(destinations)

        await driver.sleep(1000)
    } finally {
        await driver.sleep(3000)
        await driver.quit();
    }
}

function generatePdf(destinations) {
    const filename = argv.filename.endsWith('.pdf') ? argv.filename : `${argv.filename}.pdf`
    const pdfDestination = path.join(argv.output, filename)
    console.log(`Saving PDF file at: ${pdfDestination}`)

    if (fs.existsSync(pdfDestination)) {
        fs.removeSync(pdfDestination)
    }

    const pdf = new PDFDocument({ autoFirstPage: false, size: 'A4', margin: 0 })
    pdf.pipe(fs.createWriteStream(pdfDestination))

    destinations.sort().forEach(filename => {
        pdf
            .addPage()
            .image(filename, {
                fit: [pdf.page.width, pdf.page.height],
                align: 'center',
                valign: 'center',

            })
    })

    pdf.end()
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

downloadBook(argv.url)

// Just to avoid download
/*
const files = fs.readdirSync(getOutputDir()).map(file => {
    return `${getOutputDir()}/${file}`
})

generatePdf(files)
*/
