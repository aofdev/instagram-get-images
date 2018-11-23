const puppeteer = require('puppeteer')
const ora = require('ora')
const chalk = require('chalk')
const fs = require('fs')

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
      result.push(i)
    }
    return result
  },

  randomInt: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min)
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
        await page.waitFor(self.randomInt(400, 1000))
        spinner.color = 'yellow'
        let modeName = '' 
        if (mode === 'hashtags') {
          modeName = 'Tags: '
        } else if (mode === 'account') {
          modeName = 'Account: '
        } else if (mode === 'locations') {
          modeName = 'Locations: '
        }
        spinner.text = chalk.yellow(modeName + item + ' | ⏳ Scrolling [ ' + i + ' / ' + scrollLimit + ' ]')
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
      } else if (mode === 'account'){
        let dir = './result/account/' + item
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir)
        }
      } else if (mode === 'locations'){
        let dir = './result/locations/' + item
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
        let modePath = '' 
        if (mode === 'hashtags') {
          modePath = './result/hashtags/'
        } else if (mode === 'account') {
          modePath = './result/account/'
        } else if (mode === 'locations') {
          modePath = './result/locations/'
        }
        fs.writeFile(modePath + item + '/bot-' + bot + '-' + count + '.jpg', await viewSource.buffer(), function (err) {
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

  main: async (quest, mode) => {
    const browser = await puppeteer.launch({headless: false})
    if (mode === 'hashtags') {
      let hashtags = quest.hashtags.split(',')
      hashtags = await hashtags.map(hashtag => {
        hashtag = hashtag.trim()
        return hashtag
      })
      const scrollLimit = parseInt(quest.scroll)
      await self.makeFolder(hashtags, 'hashtags')
      for (const tags of hashtags) {
        const page = await browser.newPage()
        page.on('error', () => {
          console.log(chalk.red('🚀 Page Reload'))
          page.reload()
        })
        await page.goto('https://www.instagram.com/explore/tags/' + tags + '/', {
          timeout: 0
        })
        let urlImg = await self.getMedia(page, scrollLimit, tags, 'hashtags')
        console.log(chalk.cyan('🌄 Images Total: ' + urlImg.length))
        const arraySplit = await self.splitUp(urlImg, 10)
        await page.close()
        const promises = []
        for (let i = 0; i < arraySplit.length; i++) {
          promises.push(browser.newPage().then(async page => {
            page.on('error', () => {
              console.log(chalk.red('🚀 Page Reload'))
              page.reload()
            })
            await self.saveImage(page, tags, arraySplit[i], i, 'hashtags')
            await page.close()
          }))
        }
        await Promise.all(promises)
        console.log(chalk.green('✅ Succeed'))
      }
    } else if (mode === 'account'){
      const account = quest.account
      const scrollLimit = parseInt(quest.scroll)
      await self.makeFolder(account, 'account')
      const page = await browser.newPage()
      page.on('error', () => {
        console.log(chalk.red('🚀 Page Reload'))
        page.reload()
      })
      await page.goto('https://www.instagram.com/' + account + '/', {
        timeout: 0
      })
      let urlImg = await self.getMedia(page, scrollLimit, account, 'account')
      console.log(chalk.cyan('🌄 Image Total: ' + urlImg.length))
      const arraySplit = await self.splitUp(urlImg, 10) // Bot 10
      await page.close()
      const promises = []
      for (let i = 0; i < arraySplit.length; i++) {
        promises.push(browser.newPage().then(async page => {
          page.on('error', () => {
            console.log(chalk.red('🚀 Page Reload'))
            page.reload()
          })
          await self.saveImage(page, account, arraySplit[i], i, 'account')
          await page.close()
        }))
      }
      await Promise.all(promises)
      console.log(chalk.green('✅ Succeed'))
    } else if (mode === 'locations'){
      const locations = quest.locations
      const scrollLimit = parseInt(quest.scroll)
      await self.makeFolder(locations, 'locations')
      const page = await browser.newPage()
      page.on('error', () => {
        console.log(chalk.red('🚀 Page Reload'))
        page.reload()
      })
      await page.goto('https://www.instagram.com/explore/locations/' + locations + '/', {
        timeout: 0
      })
      let urlImg = await self.getMedia(page, scrollLimit, locations, 'locations')
      console.log(chalk.cyan('🌄 Image Total: ' + urlImg.length))
      const arraySplit = await self.splitUp(urlImg, 10) // Bot 10
      await page.close()
      const promises = []
      for (let i = 0; i < arraySplit.length; i++) {
        promises.push(browser.newPage().then(async page => {
          page.on('error', () => {
            console.log(chalk.red('🚀 Page Reload'))
            page.reload()
          })
          await self.saveImage(page, locations, arraySplit[i], i, 'locations')
          await page.close()
        }))
      }
      await Promise.all(promises)
      console.log(chalk.green('✅ Succeed'))
    }
    await browser.close()
  }
}
