# POC GBooks downloader

Google tries to prevent users from downloading their books, according to the copyrights laws, which seems fair.

To attempt to avoid scrapping, they add file signatures on the fly so the files cannot be download. Also, all the images are loaded using JS, to avoid too many DOM `img` elements for each page, only loading the current page, the previous one and the next one.

Once you change page, lets suppose page `N`, then only the pages `N-1` and `N+1` will be loaded.

Also Google doesn't seem to have any detection of automations like selenium.

Taking advantage of this, this script intend to open a books page, get all the URLs and the their temporary signatures/nonces and try to download it. Then advance 3 pages (which will be all new) and download them as well.

Maybe it's not the best way of doing this, also this repository have no intentions of following JS standards, since it's just a proof of concept.

## How to run
You need chrome driver. If using mac, `brew cask install chromedriver`, if not, just search for chrome driver for you OS and install it.

```bash
Usage: node index.js -u [url]

Options:
  --version       Show version number                                  [boolean]
  -u, --url       Google books book URL                               [required]
  -o, --output    Output dir
                                                    [default: "/Users/username"]
  -f, --filename  Output file name                    [default: "generated.pdf"]
  -h, --help      Show help                                            [boolean]

Examples:
  node index.js -u https://books.google.co.jp/books?id=xpto download the available pages as pdf
```
