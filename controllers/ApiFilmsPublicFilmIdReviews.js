'use strict';

const { validateReview } = require('./validator');
var utils = require('../utils/writer.js');
const reviewService = require('../service/ReviewsService.js');
const constants = require('../utils/constants.js');

module.exports.getFilmReviews = function getFilmReviews(req, res, next) {

  //retrieve a list of reviews
  var numOfReviews = 0;
  var next = 0;

  reviewService.getFilmReviewsTotal(req.params.filmId)
    .then(function (response) {

      numOfReviews = response;
      if(numOfReviews == 0){
         return utils.writeJson(res, {
              totalPages: 1,
              currentPage: 1,
              totalItems: 0,
              reviews: [],
            });
      }
      reviewService.getFilmReviews(req.query.pageNo, req.params.filmId)
        .then(function (response) {
          if (req.query.pageNo == null) var pageNo = 1;
          else var pageNo = req.query.pageNo;
          var totalPage = Math.ceil(numOfReviews / constants.ELEMENTS_IN_PAGE);
          next = Number(pageNo) + 1;
          if (pageNo > totalPage || pageNo < 1) {
            utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': "The page does not exist." }], }, 404);
          } else if (pageNo == totalPage) {
            utils.writeJson(res, {
              totalPages: totalPage,
              currentPage: pageNo,
              totalItems: numOfReviews,
              reviews: response
            });
          } else {
            utils.writeJson(res, {
              totalPages: totalPage,
              currentPage: pageNo,
              totalItems: numOfReviews,
              reviews: response,
              next: "/api/films/public/" + req.params.taskId + "?pageNo=" + next
            });
          }
        })
        .catch(function (response) {
          utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': response }], }, 500);
        });
    })
    .catch(function (response) {
      utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': response }], }, 500);
    });

};



module.exports.issueFilmReview = function issueFilmReview(req, res, next) {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    return utils.writeJson(res, { errors: [{ 'param': 'body', 'msg': "The request body must be a non-empty array of review objects." }]}, 400);
  }

  const validationErrors = [];
  for (let i = 0; i < req.body.length; i++) {
    if (!validateReview(req.body[i])) {
      validationErrors.push({
        index: i,
        errors: validateReview.errors.map((error) => ({ ...error }))
      });
    }
  }

  if (validationErrors.length !== 0) {
    return utils.writeJson(res, { errors: validationErrors }, 400);
  }

  if (req.body.some((invitation) => invitation.completed !== false)) {
    return utils.writeJson(res, { errors: [{ 'param': 'completed', 'msg': 'A new review invitation must have completed set to false.' }]}, 409);
  }

  if (req.body.some((invitation) => Number(invitation.filmId) !== Number(req.params.filmId))) {
    return utils.writeJson(res, { errors: [{ 'param': 'filmId', 'msg': 'The filmId field of each review must match the filmId path parameter.' }]}, 409);
  }

  const reviewerIds = req.body.map((invitation) => invitation.reviewerId);
  if (new Set(reviewerIds).size !== reviewerIds.length) {
    return utils.writeJson(res, { errors: [{ 'param': 'reviewerId', 'msg': 'Each reviewer may appear only once in an invitation request.' }]}, 409);
  }

  reviewService.issueFilmReview(req.body, req.user.id)
    .then(function (response) {
      utils.writeJson(res, response, 201);
    })
    .catch(function (response) {
      if (response == "USER_NOT_OWNER") {
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': 'The user is not the owner of the film' }], }, 403);
      }
      else if (response == "NO_FILMS" || response == "PRIVATE_FILM") {
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': 'The public film does not exist.' }], }, 404);
      }
      else if (response == "REVIEWER_ID_IS_NOT_USER") {
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': 'The user with ID reviewerId does not exist.' }], }, 404);
      }
      else if (response == "EXISTING_REVIEW") {
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': 'The review already exist for this film and reviewer' }], }, 409);
      }
      else {
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': response }], }, 500);
      }
    });
};
