const proxyUtils = require('../proxy/proxyUtils.js')
const reportHelper = require('../helpers/reportHelper.js')
const BASE_REPORT_URL = "/report";
const proxy = require('express-http-proxy');
const { REPORT_SERVICE_URL } = require('../helpers/environmentVariablesHelper.js');
const reqDataLimitOfContentUpload = '50mb';
const _ = require('lodash');
const { getUserDetails } = require('../helpers/userHelper');
module.exports = function (app) {

    app.all([`${BASE_REPORT_URL}/update/:reportId`, `${BASE_REPORT_URL}/publish/:reportId`, `${BASE_REPORT_URL}/publish/:reportId/:hash`, `${BASE_REPORT_URL}/retire/:reportId`, `${BASE_REPORT_URL}/retire/:reportId/:hash`],
        proxyUtils.verifyToken(),
        reportHelper.validateRoles(['REPORT_ADMIN']),
        proxy(REPORT_SERVICE_URL, {
            limit: reqDataLimitOfContentUpload,
            proxyReqOptDecorator: proxyUtils.decorateRequestHeaders(),
            proxyReqPathResolver: function (req) {
                return `${REPORT_SERVICE_URL}${req.originalUrl}`
            },
            userResDecorator: (proxyRes, proxyResData, req, res) => {
                try {
                    const data = JSON.parse(proxyResData.toString('utf8'));
                    if (req.method === 'GET' && proxyRes.statusCode === 404 && (typeof data.message === 'string' && data.message.toLowerCase() === 'API not found with these values'.toLowerCase())) res.redirect('/')
                    else return proxyUtils.handleSessionExpiry(proxyRes, proxyResData, req, res, data);
                } catch (err) {
                    return proxyUtils.handleSessionExpiry(proxyRes, proxyResData, req, res);
                }
            }
        })
    )

    app.all([`${BASE_REPORT_URL}/list`, `${BASE_REPORT_URL}/get/:reportId`],
        proxyUtils.verifyToken(),
        reportHelper.validateRoles(['REPORT_VIEWER', 'REPORT_ADMIN']),
        proxy(REPORT_SERVICE_URL, {
            limit: reqDataLimitOfContentUpload,
            proxyReqOptDecorator: proxyUtils.decorateRequestHeaders(),
            proxyReqPathResolver: function (req) {
                return `${REPORT_SERVICE_URL}${req.originalUrl}`
            },
            userResDecorator: async (proxyRes, proxyResData, req, res) => {
                try {
                    const data = JSON.parse(proxyResData.toString('utf8'));
                    const { reports, count } = _.get(data, 'result');
                    if (count === 0) return proxyResData;
                    var token = _.get(req, 'kauth.grant.access_token.token');
                    const user = await getUserDetails(req.session.userId, token);
                    const filteredReports = reportHelper.getReports(reports, user);
                    data.result.reports = filteredReports;
                    data.result.count = filteredReports.length;
                    return JSON.stringify({ ...data });
                } catch (err) {
                    console.log(err);
                    return proxyUtils.handleSessionExpiry(proxyRes, proxyResData, req, res);
                }
            }
        })
    )

    app.all([`${BASE_REPORT_URL}/get/:reportId/:hash`, `${BASE_REPORT_URL}/summary/*`],
        proxyUtils.verifyToken(),
        reportHelper.validateRoles(['REPORT_VIEWER', 'REPORT_ADMIN']),
        proxy(REPORT_SERVICE_URL, {
            limit: reqDataLimitOfContentUpload,
            proxyReqOptDecorator: proxyUtils.decorateRequestHeaders(),
            proxyReqPathResolver: function (req) {
                return `${REPORT_SERVICE_URL}${req.originalUrl}`
            },
            userResDecorator: (proxyRes, proxyResData, req, res) => {
                try {
                    const data = JSON.parse(proxyResData.toString('utf8'));
                    if (req.method === 'GET' && proxyRes.statusCode === 404 && (typeof data.message === 'string' && data.message.toLowerCase() === 'API not found with these values'.toLowerCase())) res.redirect('/')
                    else return proxyUtils.handleSessionExpiry(proxyRes, proxyResData, req, res, data);
                } catch (err) {
                    return proxyUtils.handleSessionExpiry(proxyRes, proxyResData, req, res);
                }
            }
        })
    )

    app.get('/courseReports/:slug/:filename',
        proxyUtils.verifyToken(),
        reportHelper.validateRoles(['CONTENT_CREATOR']),
        reportHelper.azureBlobStream());

    app.get('/course-reports/metadata',
        proxyUtils.verifyToken(),
        reportHelper.validateRoles(['CONTENT_CREATOR', 'REPORT_VIEWER', 'REPORT_ADMIN']),
        reportHelper.getLastModifiedDate);

    app.get(`/reports/fetch/:slug/:filename`,
        proxyUtils.verifyToken(),
        reportHelper.validateRoles(['REPORT_VIEWER', 'REPORT_ADMIN']),
        reportHelper.azureBlobStream());

    app.get('/reports/:slug/:filename',
        proxyUtils.verifyToken(),
        reportHelper.validateSlug(['public']),
        reportHelper.validateRoles(['ORG_ADMIN', 'REPORT_VIEWER']),
        reportHelper.azureBlobStream());

    app.get('/admin-reports/:slug/:filename',
        proxyUtils.verifyToken(),
        reportHelper.validateSlug(['geo-summary', 'geo-detail', 'geo-summary-district', 'user-summary', 'user-detail',
            'validated-user-summary', 'validated-user-summary-district', 'validated-user-detail']),
        reportHelper.validateRoles(['ORG_ADMIN']),
        reportHelper.azureBlobStream());
}
