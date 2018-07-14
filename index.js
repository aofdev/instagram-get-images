const chalk = require('chalk')
const clear = require('clear')
const figlet = require('figlet')
const inquirer = require('inquirer')
const app = require('./app')

clear()
console.log(
  chalk.yellow(
    figlet.textSync('IG Get Image', {
      horizontalLayout: 'full'
    })
  )
)

const askMode = () => {
  const questions = [{
    type: 'list',
    name: 'mode',
    message: 'Select Mode:',
    choices: ['Hashtags', 'Account'],
    validate: function (value) {
      if (value.length) {
        return true
      } else {
        return 'Please select Mode'
      }
    }
  }]
  return inquirer.prompt(questions)
}

const askQuestionsHashtag = () => {
  const questions = [{
    name: 'hashtags',
    type: 'input',
    message: 'Hashtags (comma separated):',
    validate: function (value) {
      if (value) {
        return true
      } else {
        return 'Please enter hashtags'
      }
    }
  },
  {
    type: 'input',
    name: 'scroll',
    default: '50',
    message: 'Enter Scroll Limit:',
    validate: function (value) {
      var pass = value.match(
        /^[\+\-]?\d*\.?\d+(?:[Ee][\+\-]?\d+)?$/
      )
      if (pass) {
        return true
      }
      return 'Please enter number'
    }
  }
  ]
  return inquirer.prompt(questions)
}

const askQuestionsAccount = () => {
  const questions = [{
    name: 'account',
    type: 'input',
    message: 'Enter Account:',
    validate: function (value) {
      if (value.length) {
        return true
      } else {
        return 'Please enter Account'
      }
    }
  },
  {
    type: 'input',
    name: 'scroll',
    default: '50',
    message: 'Enter Scroll Limit:',
    validate: function (value) {
      var pass = value.match(
        /^[\+\-]?\d*\.?\d+(?:[Ee][\+\-]?\d+)?$/
      )
      if (pass) {
        return true
      }
      return 'Please enter number'
    }
  }
  ]
  return inquirer.prompt(questions)
}

const setQuest = async () => {
  const mode = await askMode()
  if (mode.mode === 'Hashtags') {
    const quest = await askQuestionsHashtag()
    await app.main(quest, 'hashtags')
  } else {
    const quest = await askQuestionsAccount()
    await app.main(quest, 'account')
  }
}

setQuest()
