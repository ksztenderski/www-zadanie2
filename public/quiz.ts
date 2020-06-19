class QuestionTuple {
    question: string;
    answers: number[];
    penalty: number;
}

class AnswerTuple {
    answer: number = null;
    timeSpent: number = 0;
}

class HtmlHandler {
    answersHTML = new Array<string>();
    penaltyBox = document.getElementById('penalty');
    startButton = document.getElementById('start_button');
    finishButton = document.getElementById('finish_button');
    cancelButton = document.getElementById('cancel_button');
    nextQuestionButton = document.getElementById('next_question_button');
    previousQuestionButton = document.getElementById('previous_question_button');
    correctAnswerColor = '#21bf73';
    wrongAnswerColor = '#fd5e53';
    avgTimeSpent: number[];

    constructor(quiz: Quiz) {
        this.startButton.addEventListener('click', quiz.startQuiz);
        this.finishButton.addEventListener('click', quiz.finishQuiz);
        this.cancelButton.addEventListener('click', quiz.cancelQuiz);
        this.nextQuestionButton.addEventListener('click', quiz.nextQuestion);
        this.previousQuestionButton.addEventListener('click', quiz.previousQuestion);
    }

    // Shuffles given array.
    shuffle(array: number[]) {
        let ctr = array.length, tmp, index: number;

        while (ctr > 0) {
            index = Math.floor(Math.random() * ctr);
            ctr--;
            tmp = array[ctr];
            array[ctr] = array[index];
            array[index] = tmp;
        }
        return array;
    }

    // Get all the answers as html elements.
    getAnswersHTML(questions: QuestionTuple[]) {
        for (let i = 0; i < questions.length; i++) {
            let question = questions[i];
            let currentAnswersHTML = new Array<string>();

            let shuffledAnswers = question.answers;

            this.shuffle(shuffledAnswers);

            for (const answer of shuffledAnswers) {
                currentAnswersHTML.push(
                    `<label class="radio radio_active">${answer}
                <input type="radio" name="question${i}" value="${answer}">
                <span class="checkmark"></span>
            </label>`);
            }

            this.answersHTML.push(
                '<div class="answer">' + currentAnswersHTML.join('') + '</div>'
            );
        }

        document.getElementById('answers').innerHTML = this.answersHTML.join('');
    }

    displayQuestion(quiz: Quiz) {
        document.getElementById('question_number').innerText = (quiz.currentQuestion + 1) + ' / ' + quiz.questions.length;
        document.getElementById('question').innerText = quiz.questions[quiz.currentQuestion].question;
        (document.getElementsByClassName('answer')[quiz.currentQuestion] as HTMLElement).style.display = 'block';

        if (quiz.quizTime) {
            this.penaltyBox.innerText = 'Penalty: ' + quiz.questions[quiz.currentQuestion].penalty + 's';
        } else {
            document.getElementById('timer').innerText = 'AVG: ' + this.avgTimeSpent[quiz.currentQuestion].toString(10).substr(0, 5) + 's';

            if (quiz.answers[quiz.currentQuestion].answer != quiz.correctAnswers[quiz.currentQuestion]) {
                this.penaltyBox.innerText = 'Penalty: ' + quiz.questions[quiz.currentQuestion].penalty + 's';
                this.penaltyBox.style.backgroundColor = this.wrongAnswerColor;
            } else {
                this.penaltyBox.innerText = 'No penalty';
                this.penaltyBox.style.backgroundColor = this.correctAnswerColor;
            }
        }

        this.updateButtons(quiz.questions, quiz.currentQuestion);

        this.addAnswersEventListener(quiz);
    }

    // Adds event listener to radio buttons in quiz.
    addAnswersEventListener(quiz: Quiz) {
        let answersRadio = document.getElementsByClassName('radio');

        for (let i = 0; i < answersRadio.length; ++i) {
            answersRadio[i].addEventListener('click', () => {
                if (quiz.answers[quiz.currentQuestion].answer == null) {
                    quiz.questionsAnsweredCount++;
                    if (quiz.questionsAnsweredCount == quiz.questions.length) {
                        this.finishButton.classList.remove('disabled_button');
                        this.finishButton.classList.add('button');
                    }
                }
                quiz.answers[quiz.currentQuestion].answer = parseInt((answersRadio[i] as HTMLElement).innerText);
            })
        }
    }

    updateButtons(questions: QuestionTuple[], currentQuestion: number) {
        if (currentQuestion == 0 && this.previousQuestionButton.classList.contains('button')) {
            this.previousQuestionButton.classList.remove('button');
            this.previousQuestionButton.classList.add('disabled_button');
        }

        if (currentQuestion == questions.length - 1 && this.nextQuestionButton.classList.contains('button')) {
            this.nextQuestionButton.classList.remove('button');
            this.nextQuestionButton.classList.add('disabled_button');
        }

        if (currentQuestion != 0) {
            if (this.previousQuestionButton.classList.contains('disabled_button')) {
                this.previousQuestionButton.classList.remove('disabled_button');
                this.previousQuestionButton.classList.add('button');
            }
        }

        if (currentQuestion != questions.length - 1) {
            if (this.nextQuestionButton.classList.contains('disabled_button')) {
                this.nextQuestionButton.classList.remove('disabled_button');
                this.nextQuestionButton.classList.add('button');
            }
        }
    }
}

class Quiz {
    htmlHandler: HtmlHandler;
    questions: QuestionTuple[];
    correctAnswers: number[];
    answers: Array<AnswerTuple>;
    currentQuestion: number;
    questionsAnsweredCount: number;
    startTime: number;
    lastSwapTime: number;
    score: number;
    quizTime: boolean;
    timer;

    constructor(jsonQuestions: string) {
        this.questions = JSON.parse(jsonQuestions);
        this.answers = new Array<AnswerTuple>();
        this.htmlHandler = new HtmlHandler(this);
        this.htmlHandler.getAnswersHTML(this.questions);
        this.createLeaderboards();
    }

    createLeaderboards() {
        let topScores = document.getElementById('top_scores');
        let Httpreq = new XMLHttpRequest(); // a new request
        let quizId = document.getElementById("quiz_title").getAttribute("quiz_id");

        Httpreq.open("GET", 'http://localhost:3000/quiz_top_scores/' + quizId, false);
        Httpreq.send(null);

        let results = JSON.parse(Httpreq.responseText).top_scores;

        // Sets top scores table.
        if (results.length > 0) {
            let topScoresHTML = new Array<string>();

            topScoresHTML.push(
                '<tr> <th colspan="2">Top Scores</th> </tr> <tr> <th>Who</th> <th>Score</th> </tr>'
            );

            for (const result of results) {
                topScoresHTML.push(
                    `<tr>
                        <td>${result.username}</td>
                        <td>${result.score}</td>
                    </tr>`
                )
            }

            topScores.innerHTML = topScoresHTML.join('');
        }
    }

    addQuestionTime() {
        let now = new Date().getTime();

        (this.answers)[this.currentQuestion].timeSpent += now - this.lastSwapTime;
        this.lastSwapTime = now;
    }

    startQuiz = () => {
        document.getElementById('start_view').style.display = 'none';
        document.getElementById('quiz_view').style.display = 'block';

        if (document.getElementById('start_button').innerText == 'show quiz') {
            this.showQuiz();
            return;
        }

        let start = new Date().getTime();

        this.startTime = start;
        this.quizTime = true;
        this.currentQuestion = 0;
        this.questionsAnsweredCount = 0;
        this.lastSwapTime = this.startTime;

        this.timer = setInterval(function () {
            let now = new Date().getTime();
            let hours = new Date(now - start).getUTCHours();
            let minutes = new Date(now - start).getUTCMinutes();
            let seconds = new Date(now - start).getUTCSeconds();

            let asTime = (x) => {
                return x < 10 ? 0 + String(x) : String(x);
            }

            document.getElementById('timer').innerText = (hours == 0 ? '' : asTime(hours) + ':') + asTime(minutes) + ':' + asTime(seconds);
        }, 1000);

        for (const question of this.questions) {
            this.answers.push(new AnswerTuple());
        }

        if (this.questions.length == 0) {
            this.htmlHandler.finishButton.classList.remove('disabled_button');
            this.htmlHandler.finishButton.classList.add('button');
            this.htmlHandler.nextQuestionButton.classList.remove('button');
            this.htmlHandler.nextQuestionButton.classList.add('disabled_button');
        } else {
            this.htmlHandler.displayQuestion(this);
        }
    }

    showQuiz() {
        this.quizTime = false;
        this.htmlHandler.penaltyBox.style.display = 'block';

        let Httpreq = new XMLHttpRequest(); // a new request
        let quizId = document.getElementById('quiz_title').getAttribute('quiz_id');
        Httpreq.open("GET", 'http://localhost:3000/quiz_stats/' + quizId, false);
        Httpreq.send(null);

        let response = JSON.parse(Httpreq.responseText);
        this.score = response.score;
        this.correctAnswers = response.correctAnswers;
        this.htmlHandler.avgTimeSpent = response.averageTimeSpent;
        let submittedAnswers = response.answers;

        // Setting submitted answers.
        for (let i = 0; i < this.questions.length; i++) {
            let currentAnswers = document.getElementsByName('question' + i);
            this.answers.push(new AnswerTuple());
            this.answers[i].answer = submittedAnswers[i];

            for (let j = 0; j < currentAnswers.length; j++) {
                if (parseInt((currentAnswers[j] as HTMLInputElement).value) == submittedAnswers[i]) {
                    (currentAnswers[j] as HTMLInputElement).checked = true;
                }
            }
        }

        this.showAnswers();
    }

    showAnswers() {
        this.htmlHandler.penaltyBox.style.display = 'block';
        document.getElementById('score').innerText = 'Your score: ' + this.score;

        let quizTimeElements = document.getElementsByClassName('quiz_time');
        let quizFinishedElements = document.getElementsByClassName('quiz_finished');
        let checkmarks = document.getElementsByClassName('checkmark');
        let radioButtons = document.getElementsByClassName('radio');

        for (let i = 0; i < quizTimeElements.length; i++) {
            (quizTimeElements[i] as HTMLElement).style.display = 'none';
        }

        for (let i = 0; i < quizFinishedElements.length; i++) {
            (quizFinishedElements[i] as HTMLElement).style.display = 'block';
        }

        for (let i = 0; i < checkmarks.length; i++) {
            (checkmarks[i] as HTMLElement).style.display = 'none';
            (radioButtons[i] as HTMLElement).style.cursor = 'default';
            (radioButtons[i] as HTMLElement).classList.remove('radio_active');
        }

        if (this.questions.length == 0) return;

        this.htmlHandler.nextQuestionButton.classList.remove('disabled_button');
        this.htmlHandler.nextQuestionButton.classList.add('button');

        // Setting wrong and correct answers.
        for (let i = 0; i < this.questions.length; i++) {
            let currentAnswers = document.getElementsByName('question' + i);

            for (let j = 0; j < currentAnswers.length; j++) {
                if ((currentAnswers[j] as HTMLInputElement).checked) {
                    currentAnswers[j].parentElement.style.backgroundColor = this.htmlHandler.wrongAnswerColor;
                }

                if (parseInt((currentAnswers[j] as HTMLInputElement).value) == this.correctAnswers[i]) {
                    currentAnswers[j].parentElement.style.backgroundColor = this.htmlHandler.correctAnswerColor;
                }
            }
        }

        this.currentQuestion = 0;

        this.htmlHandler.displayQuestion(this);
    }

    finishQuiz = () => {
        if (this.htmlHandler.finishButton.classList.contains('disabled_button')) return;

        if (this.questions.length > 0) {
            (document.getElementsByClassName('answer')[this.currentQuestion] as HTMLElement).style.display = 'none';
            this.addQuestionTime();
        }

        clearInterval(this.timer);

        this.quizTime = false;
        let fullTime = new Date().getTime() - this.startTime;

        let timeSpent: number[] = [];
        let answers: number[] = [];
        for (const answer of this.answers) {
            answers.push(answer.answer);
            timeSpent.push(answer.timeSpent / fullTime);
        }

        let Httpreq = new XMLHttpRequest(); // a new request
        let quizId = document.getElementById("quiz_title").getAttribute("quiz_id");
        Httpreq.open("POST", 'http://localhost:3000/quiz_answers/' + quizId, false);
        Httpreq.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Httpreq.send(JSON.stringify({
            answers: answers,
            time_spent: timeSpent
        }));

        let response = JSON.parse(Httpreq.responseText);
        this.score = response.score;
        this.correctAnswers = response.correctAnswers;
        this.htmlHandler.avgTimeSpent = response.averageTimeSpent;

        this.showAnswers();
    }

    cancelQuiz = () => {
        document.getElementById('quiz_view').style.display = 'none';
        document.getElementById('cancel_view').style.display = 'block';

        clearInterval(this.timer);
    }

    previousQuestion = () => {
        if (this.htmlHandler.previousQuestionButton.classList.contains('disabled_button')) return;

        (document.getElementsByClassName('answer')[this.currentQuestion] as HTMLElement).style.display = 'none';

        if (this.quizTime) {
            this.addQuestionTime();
        }

        --this.currentQuestion;
        this.htmlHandler.displayQuestion(this);
    }

    nextQuestion = () => {
        if (this.htmlHandler.nextQuestionButton.classList.contains('disabled_button')) return;

        (document.getElementsByClassName('answer')[this.currentQuestion] as HTMLElement).style.display = 'none';

        if (this.quizTime) {
            this.addQuestionTime();
        }

        ++this.currentQuestion;
        this.htmlHandler.displayQuestion(this);
    }
}

let Httpreq = new XMLHttpRequest(); // a new request
let quizId = document.getElementById("quiz_title").getAttribute("quiz_id")
Httpreq.open("GET", 'http://localhost:3000/quiz_data/' + quizId, false);
Httpreq.send(null);
new Quiz(JSON.parse(Httpreq.responseText));
