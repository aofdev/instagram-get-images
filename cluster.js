const puppeteer = require('puppeteer')
const ora = require('ora')
const chalk = require('chalk')
const fs = require('fs')
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
let forks = numCPUs;

const self = module.exports = {

  findDuplicateInArray: async (hrefs) => {
    let i = hrefs.length
    let len = hrefs.length
    let result = []
    let obj = {}
    for (i = 0; i < len; i++) {
      obj[hrefs[i]] = 0
    }
    for (i in obj) {
      if (i !== '') {
        result.push(i)
      }
    }
    return result
  },

  getMedia: async (page, scrollLimit, item, mode) => {
    let mediaText = []
    let previousHeight
    let spinner = ora('Loading').start()
    for (let i = 1; i <= scrollLimit; i++) {
      try {
        previousHeight = await page.evaluate('document.body.scrollHeight')
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`)
        await page.waitFor(500)
        spinner.color = 'yellow'
        spinner.text = chalk.yellow((mode === 'hashtags' ? 'Tags: ' : 'Account: ') + item + ' | ⏳ Scrolling [ ' + i + ' / ' + scrollLimit + ' ]')
        const textPost = await page.evaluate(() => {
          const images = document.querySelectorAll('a > div > div.KL4Bh > img')
          return [].map.call(images, img => img.src)
        })
        for (let post of textPost) {
          mediaText.push(post)
        }
        mediaText = await self.findDuplicateInArray(mediaText)
      } catch (e) {
        spinner.fail(chalk.red('Scroll Timeout ' + e))
        await page.evaluate('window.scrollTo(0, document.documentElement.scrollTop || document.body.scrollTop)')
        const imgPost = await page.evaluate(() => {
          const images = document.querySelectorAll('a > div > div.KL4Bh > img')
          return [].map.call(images, img => img.src)
        })
        for (let post of imgPost) {
          mediaText.push(post)
        }
        mediaText = await self.findDuplicateInArray(mediaText)
        break
      }
    }
    spinner.succeed(chalk.yellow('Scroll Succeed'))
    return mediaText
  },

  makeFolder: async (item, mode) => {
    try {
      if (mode === 'hashtags') {
        for (const name of item) {
          let dir = './result/hashtags/' + name
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir)
          }
        }
      } else {
        let dir = './result/account/' + item
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir)
        }
      }
    } catch (err) {
      console.log(chalk.red('❌ Error makeFolder: ' + err))
    }
  },

  splitUp: (arr, n) => {
    let rest = arr.length % n
    let restUsed = rest
    let partLength = Math.floor(arr.length / n)
    let result = []
    for (let i = 0; i < arr.length; i += partLength) {
      let end = partLength + i
      let add = false
      if (rest !== 0 && restUsed) {
        end++
        restUsed--
        add = true
      }
      result.push(arr.slice(i, end))
      if (add) {
        i++
      }
    }
    return result
  },

  saveImage: async (page, item, urlImg, bot, mode) => {
    let count = 0
    let countTotal = urlImg.length
    for (const img of urlImg) {
      try {
        let viewSource = await page.goto(img)
        fs.writeFile((mode === 'hashtags' ? './result/hashtags/' : './result/account/') + item + '/bot-' + bot + '-' + count + '.jpg', await viewSource.buffer(), function (err) {
          if (err) {
            throw (err)
          }
          count = count + 1
          console.log(chalk.green('BOT🤖[' + bot + ']The file was saved! [ ' + count + ' / ' + countTotal + ' ]'))
        })
      } catch (error) {
        console.log(chalk.red('❌ Error: invalid URL undefined'))
        continue
      }
    }
  },

  removeFileText: async (index) => {
    let dir = './source/' + index + '.txt'
    if (fs.existsSync(dir)) {
      fs.unlinkSync(dir)
    }
  },

  writeFileText: async (data, index) => {
    for (const link of data) {
      let dir = './source/' + index + '.txt'
      await fs.appendFile(dir, link + '\n' ,  (err) => {
        if (err) return console.log(err);
      });
    }
  },

  readFileText: async (index) => {
    let dir = './source/' + index + '.txt'
    const link = await fs.readFileSync(dir).toString().split("\n");
    const cleanLink = await self.findDuplicateInArray(link)
    return cleanLink
  },

  connectToChrome: async (name, links, task, mode) => {
    const browser = await puppeteer.launch({headless: false, args: ['--no-sandbox']});
    const page = await browser.newPage()
    page.on('error', () => {
      console.log(chalk.red('🚀 Page Reload'))
      page.reload()
    })
    await self.saveImage(page, name, links, task, mode)
    await page.close()
    await browser.close()
    console.log(chalk.green('✅ Succeed Worker ' + task))
  },

  main: async (data, mode, scrollTotal) => {
    const browser = await puppeteer.launch({ headless: false})
    const page = await browser.newPage()
    page.on('error', () => {
      console.log(chalk.red('🚀 Page Reload'))
      page.reload()
    })

    const scrollLimit = parseInt(scrollTotal)
    let urlImg = null

    if (mode === 'hashtags') {
      const hashtag = data
      await self.makeFolder(hashtag, 'hashtags')
      await page.goto('https://www.instagram.com/explore/tags/' + hashtag + '/', {
        timeout: 0
      })
      urlImg = await self.getMedia(page, scrollLimit, hashtag, 'hashtags')
    } else {
      const account = data
      await self.makeFolder(account, 'account')
      await page.goto('https://www.instagram.com/' + account + '/', {
        timeout: 0
      })
      urlImg = await self.getMedia(page, scrollLimit, account, 'account')
    }

    console.log(chalk.cyan('🌄 Images Total: ' + urlImg.length))
    const arraySplit = await self.splitUp(urlImg, numCPUs + 1)
    await page.close()
    await browser.close()
    for (let i = 0; i < arraySplit.length; i++) {
      await self.removeFileText(i)
      await self.writeFileText(arraySplit[i], i)
    }
    },

  initCluster: async (data, mode, scrollTotal) => {
    if (cluster.isMaster) {
      await self.main(data, mode, scrollTotal)  
      for (let i = 0; i <= forks; i++) {
          cluster.fork();
          console.log('Fork #' + i);
      }
    } else {
      let worker = cluster.worker.id - 1
      const result = await self.readFileText(worker)
      self.connectToChrome(data, result, worker, mode)
    }
  },
}

self.initCluster('games', 'hashtags', '60')
// self.initCluster('games', 'account', '60')