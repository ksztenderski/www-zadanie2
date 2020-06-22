let express = require('express');
let router = express.Router();
import {expect} from 'chai';

function checkSession(req, resolve, reject) {
    if (req.session.user_id === undefined) {
        reject();
    } else {
        req.db.get("SELECT * FROM users WHERE id = ?", [req.session.user_id],
            function (err, row) {
                if (row !== undefined && req.session.hash === req.sha256(row.salt + row.password)) {
                    resolve();
                } else {
                    reject();
                }
            });
    }
}

function handleSession(req, res, resolve) {
    checkSession(req, resolve, () => res.redirect('/'));
}

router.get('/', function (req, res) {
    checkSession(req, () => {
        req.db.all("SELECT id, name FROM quizzes WHERE id NOT IN (" +
            "SELECT quiz_id FROM stats WHERE user_id = ?)", [req.session.user_id],
            function (err, list) {
                res.render('quiz_list', {
                    show_history: false,
                    list: list
                });
            })
    }, () => {
        res.render('index');
    });
});

router.get('/history', function (req, res) {
    handleSession(req, res, () => {
        req.db.all("SELECT id, name FROM quizzes WHERE id IN (" +
            "SELECT quiz_id FROM stats WHERE user_id = ?)", [req.session.user_id],
            function (err, list) {
                res.render('quiz_list', {
                    show_history: true,
                    list: list
                });
            })
    });
});

router.post('/', function (req, res) {
    // login
    req.db.get("SELECT * FROM users WHERE username = ? AND password = ?", [req.body.login, req.body.password],
        function (err, row) {
            if (row !== undefined) {
                req.session.user_id = row.id;
                req.session.hash = req.sha256(row.salt + row.password);
            }
            res.redirect('/');
        })
});

router.get('/logout', function (req, res) {
    delete (req.session.user_id);
    delete (req.session.hash);
    res.redirect('/');
});

router.get('/change_password', function (req, res) {
    handleSession(req, res, () => {
        res.render('change_password', {
            error: ""
        });
    });
});

router.post('/changed_password', function (req, res) {
    req.db.get("SELECT * FROM users WHERE id = ? AND password = ?", [req.session.user_id, req.body.old_password],
        function (err, row) {
            if (row === undefined) {
                res.render('change_password', {
                    error: "Incorrect old password."
                });
            } else if (req.body.new_password !== req.body.confirm_password) {
                res.render('change_password', {
                    error: "New passwords don't match."
                });
            } else {
                let salt = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                req.db.run("UPDATE users SET password = ?, salt = ? WHERE id = ?", [req.body.new_password, salt, req.session.user_id]);
                req.session.hash = req.sha256(salt + req.body.new_password);
                res.redirect('/');
            }
        });
});

/* GET quiz page. */
router.get('/quiz/:quizId', function (req, res) {
    handleSession(req, res, () => {
        req.db.get("SELECT * FROM quizzes WHERE id = ?", [req.params.quizId],
            function (err, quiz) {
                if (quiz !== undefined) {
                    req.db.get("SELECT * FROM stats WHERE quiz_id = ? AND user_id = ?", [req.params.quizId, req.session.user_id],
                        function (err, row) {
                            if (row === undefined) {
                                res.render('quiz', {
                                    quiz_id: quiz.id,
                                    quiz_name: quiz.name,
                                    show_history: false
                                });
                            } else {
                                // Trying to get already submitted quiz.
                                res.render('quiz_submitted', {
                                    quizId: req.params.quizId
                                });
                            }
                        });
                } else {
                    res.render('quiz_not_found');
                }
            });

    });
});

/* GET quiz history. */
router.get('/quiz_history/:quizId', function (req, res) {
    handleSession(req, res, () => {
        req.db.get("SELECT * FROM quizzes WHERE id = ?", [req.params.quizId],
            function (err, quiz) {
                if (quiz !== undefined) {
                    req.db.get("SELECT * FROM stats WHERE quiz_id = ? AND user_id = ?", [req.params.quizId, req.session.user_id],
                        function (err, row) {
                            if (row !== undefined) {
                                res.render('quiz', {
                                    quiz_id: quiz.id,
                                    quiz_name: quiz.name,
                                    show_history: true
                                });
                            } else {
                                res.render('quiz_not_submitted', {
                                    quizId: req.params.quizId
                                })
                            }
                        });
                } else {
                    res.render('quiz_not_found')
                }
            });
    });
});

router.get('/quiz_data/:quizId', function (req, res) {
    handleSession(req, res, () => {
        req.db.get("SELECT * FROM quizzes WHERE id = ?", [req.params.quizId],
            function (err, row) {
                if (row !== undefined) {
                    req.session.quiz_start = new Date().getTime();
                    res.json(row.data);
                }
            });
    });
});

function getStats(req, res, correctAnswers, answers, score) {
    req.db.all("SELECT time_spent FROM stats WHERE quiz_id = ?", [req.params.quizId],
        function (err, timeSpent) {
            if (timeSpent !== undefined) {
                let averageTimeSpent: number[] = [];
                for (const element of timeSpent) {
                    let array = JSON.parse(element.time_spent).timeSpent;
                    for (let i = 0; i < array.length; i++) {
                        if (averageTimeSpent[i] === undefined) {
                            averageTimeSpent[i] = 0;
                        }
                        averageTimeSpent[i] += array[i];
                    }
                }
                for (let i = 0; i < timeSpent.length; i++) {
                    averageTimeSpent[i] /= timeSpent.length;
                }

                res.json({
                    score: score,
                    answers: answers,
                    correctAnswers: correctAnswers,
                    averageTimeSpent: averageTimeSpent
                });
            }
        });
}

router.get('/quiz_top_scores/:quizId', function (req, res) {
    handleSession(req, res, () => {
        req.db.all("SELECT username, score FROM stats LEFT JOIN users ON user_id = id WHERE quiz_id = ? ORDER BY score LIMIT 5", [req.params.quizId],
            function (err, topScores) {
                res.json({top_scores: topScores});
            });
    });
})

router.get('/quiz_stats/:quizId', function (req, res) {
    handleSession(req, res, () => {
        req.db.get("SELECT answers FROM quizzes WHERE id = ?", [req.params.quizId],
            function (err, correctAnswers) {
                req.db.get("SELECT score, answers FROM stats WHERE quiz_id = ? AND user_id = ?", [req.params.quizId, req.session.user_id],
                    function (err, row) {
                        if (row !== undefined) {
                            getStats(req, res, JSON.parse(correctAnswers.answers).answers, JSON.parse(row.answers).answers, row.score);
                        } else {
                            getStats(req, res, JSON.parse(correctAnswers.answers).answers, null, null);
                        }
                    });
            });
    });
});

router.post('/quiz_answers/:quizId', function (req, res) {
    handleSession(req, res, () => {
        req.db.get("SELECT * FROM quizzes WHERE id = ?", [req.params.quizId],
            function (err, row) {
                if (row !== undefined) {
                    let quizTime = new Date(new Date().getTime() - req.session.quiz_start).getSeconds();
                    let timeSpent: number[] = [];
                    let request = req.body;
                    let data = JSON.parse(row.data);
                    let correctAnswers = JSON.parse(row.answers).answers;
                    let sum = 0;

                    for (let i = 0; i < correctAnswers.length; i++) {
                        sum += request.time_spent[i];
                        timeSpent.push(quizTime * request.time_spent[i]);
                    }
                    console.log(sum);
                    expect(sum).closeTo(1,0.01);
                    for (let i = 0; i < data.length; i++) {
                        if (correctAnswers[i] != request.answers[i]) {
                            quizTime += data[i].penalty;
                        }
                    }

                    req.db.run("INSERT INTO stats VALUES(?, ?, ?, ?, ?)",
                        [req.params.quizId, req.session.user_id, quizTime, JSON.stringify({answers: request.answers}), JSON.stringify({timeSpent: timeSpent})],
                        function () {
                            getStats(req, res, correctAnswers, request.answers, quizTime);
                        });
                }
            });
    });
})

module.exports = router;
