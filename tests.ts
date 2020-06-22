import {By, until} from 'selenium-webdriver';
import {expect} from 'chai';
import {driver} from 'mocha-webdriver';

async function login(password) {
    await driver.get('http://localhost:3000/');
    await driver.findElement(By.name('login')).sendKeys('user_1');
    await driver.findElement(By.name('password')).sendKeys(password);
    await driver.find('input[type=submit]').click();
}

async function changePassword(oldPassword, newPassword) {
    await driver.find('[href="/change_password"]').click();
    await driver.findElement(By.name('old_password')).sendKeys(oldPassword);
    await driver.findElement(By.name('new_password')).sendKeys(newPassword);
    await driver.findElement(By.name('confirm_password')).sendKeys(newPassword);
    await driver.find('input[type=submit]').click();
}

describe('tests', function () {
    it('session test', async function () {
        this.timeout(20000);
        await login('user_1');

        let savedCookies = await driver.manage().getCookies();

        await driver.manage().deleteAllCookies();

        await login('user_1');
        await changePassword('user_1', 'abc');

        await driver.manage().deleteAllCookies();

        for (const savedCookie of savedCookies) {
            savedCookie.domain = null;
            await driver.manage().addCookie(savedCookie);
        }

        // To check session, we need to send some get request.
        await driver.find('[href="/"]').click();
        await driver.wait(until.elementLocated(By.id('login_view')));

        await login('abc');
        await changePassword('abc', 'user_1');
        await driver.find('[href="/logout"]').click();
    });

    async function openQuiz() {
        await login('user_1');

        let links = await driver.findElements(By.name('link'));

        if (links.length == 0) {
            return;
        }
        await links[0].click();
    }

    async function doQuiz() {
        await driver.findElement(By.id('start_button')).click();

        let button = await driver.findElement(By.id('next_question_button'));

        let nr = 0;

        while ((await button.getAttribute('class')).indexOf('disabled_button') == -1) {
            await driver.findElement(By.name('question' + nr++)).click();
            await button.click();
        }

        await driver.findElement(By.name('question' + nr)).click();
        await driver.findElement(By.id('finish_button')).click();
    }

    it('same quiz test', async function () {
        this.timeout(20000);

        await openQuiz();

        let quizId = await (await driver.findElement(By.id('quiz_title'))).getAttribute('quiz_id');

        await doQuiz();

        await driver.findElement(By.id('home')).click();

        await driver.get('http://localhost:3000/quiz/' + quizId);

        expect(await driver.find('h1').getText()).equal('You\'ve already submitted this quiz.');

        await driver.get('http://localhost:3000/');
        await driver.find('[href="/logout"]').click();
    });

    it('percentage time test', async function () {
        this.timeout(20000);

        await openQuiz();

        await new Promise(res => setTimeout(_ => res(), 3000));

        await doQuiz();

        await driver.get('http://localhost:3000/');
        await driver.find('[href="/logout"]').click();
    })
})