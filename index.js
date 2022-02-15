/*
    npm i log4j
    npm i ws
    npm i express
    npm i body-parser
    npm i axios
    npm i moment
    npm i redis
    npm i mysql
    npm i lib-qqwry
    npm install --global --production windows-build-tools
 */
const log4js = require('log4js')
const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const mutipart = require('connect-multiparty')
const redis = require('redis')
const mutipartMiddeware = mutipart()
const moment = require('moment')
const mysql = require('mysql')
const libqqwry = require('lib-qqwry')
const qqwry = libqqwry(true, `${__dirname}/ipdata.js`)
const WebSocket = require('ws')
const crypto = require('crypto')
const googleAuth = new (require('google_authenticator').authenticator)()
const log4jscfg = {
	appenders: {
		out: {
			type: 'stdout',
			layout: {
				type: 'pattern',
				pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %m',
			},
		},
		files: {
			type: 'file',
			filename: './_log/logfile.log',
			maxLogSize: 1024 * 1024 * 10,
			backups: 100,
			layout: {
				type: 'pattern',
				pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %m',
			},
		},
	},
	categories: {
		default: {
			appenders: ['out', 'files'],
			level: 'trace',
		},
	},
	replaceConsole: true,
}
log4js.configure(log4jscfg)
const logger = log4js.getLogger()
console.log = function (...args) {
	logger.debug.apply(logger, args)
}
console.error = function (...args) {
	logger.error.apply(logger, args)
}
console.info = function (...args) {
	logger.info.apply(logger, args)
}
process.on('uncaughtException', function (err) {
	logger.error(err)
	if (err.ctx && err.errmsg) {
		err.ctx.status(200).send({
			code: 100,
			msg: err.errmsg,
		})
	}
})

function respOk(data) {
	this.status(200).send({
		code: 200,
		data: data,
	})
}

function respErr(msg, data) {
	this.status(200).send({
		code: 100,
		msg: msg,
		data: data,
	})
}

function getClientIp() {
	let ip = this.headers['x-forwarded-for'] || this.connection.remoteAddress || this.socket.remoteAddress || this.connection.socket.remoteAddress || ''
	if (ip == '::1') return '127.0.0.1'
	ip = ip.match(/\d+.\d+.\d+.\d+/)
	ip = ip ? ip.join('.') : null
	return ip
}
function getString(field) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) return null
	return this.body[field]
}
function getStringNotNullAndEmpty(field) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null || this.body[field].trim() == '') throw `请填写:${field}`
	return this.body[field]
}
function getStringNotNull(field) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	return this.body[field]
}
function getInt(field) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (Math.floor(v) != v) throw `必须是整数:${field}`
	return v
}
function getIntWithMinValue(field, minval) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (Math.floor(v) != v) throw `必须是整数:${field}`
	if (v <= minval) throw `必须大于${minval}:${field}`
	return v
}
function getIntWithMaxValue(field, maxval) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (Math.floor(v) != v) throw `必须是整数:${field}`
	if (v >= maxval) throw `必须小于${maxval}:${field}}`
	return v
}
function getIntInRange(field, minval, maxval) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (Math.floor(v) != v) throw `必须是整数:${field}`
	if (v <= minval || v >= maxval) throw `必须小于在[${minval},${maxval}]之间:${field}`
	return v
}
function getIntInEnum(field, evalue) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (Math.floor(v) != v) throw `必须是整数:${field}`
	let finded = false
	for (let i = 0; i < evalue.length; i++) {
		if (evalue[i] == v) {
			finded = true
			break
		}
	}
	if (!finded) throw `必须是其中之一${JSON.stringify(evalue)}:${field}`
	return v
}
function getNumber(field) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `${field}必须是数字`
	return v
}
function getNumberWithMinValue(field, minval) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (v <= minval) throw `必须大于${minval}:${field}`
	return v
}
function getNumberWithMaxValue(field, maxval) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (v >= maxval) throw `必须小于${maxval}:${field}}`
	return v
}
function getNumberInRange(field, minval, maxval) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	if (v <= minval || v >= maxval) throw `必须小于在[${minval},${maxval}]之间:${field}`
	return v
}
function getNumberInEnum(field, evalue) {
	if (!this.body) this.body = this.query
	if (this.body[field] == undefined || this.body[field] == null) throw `请填写:${field}`
	let v = Number(this.body[field])
	if (isNaN(v)) throw `必须是数字:${field}`
	let finded = false
	for (let i = 0; i < evalue.length; i++) {
		if (evalue[i] == v) {
			finded = true
			break
		}
	}
	if (!finded) throw `必须是其中之一${JSON.stringify(evalue)}:${field}`
	return v
}
let redis_token = null
let httpdata = {}
let redisdata = {}
class bhttp {
	constructor(name, port) {
		this.name = name
		let app = express()
		app.use((req, res, next) => {
			res.header('Access-Control-Allow-Origin', '*')
			res.header('Access-Control-Allow-Methods', 'GET,POST')
			res.header('Access-Control-Allow-Headers', 'Content-Type, x-token, Content-Length, X-Requested-With')
			next()
		})
		app.listen(port)
		console.log(`开启服务[${name}]:`, port)
		httpdata[name] = {
			app: app,
		}
	}
	get = (url, callback) => {
		httpdata[this.name].app.get(url, (req, ctx) => {
			try {
				ctx.respErr = respErr
				ctx.respOk = respOk
				req.getClientIp = getClientIp
				req.getString = getString
				req.getStringNotNullAndEmpty = getStringNotNullAndEmpty
				req.getStringNotNull = getStringNotNull
				req.getInt = getInt
				req.getIntWithMinValue = getIntWithMinValue
				req.getIntWithMaxValue = getIntWithMaxValue
				req.getIntInRange = getIntInRange
				req.getIntInEnum = getIntInEnum
				req.getNumber = getNumber
				req.getNumberWithMinValue = getNumberWithMinValue
				req.getNumberWithMaxValue = getNumberWithMaxValue
				req.getNumberInEnum = getNumberInEnum
				req.getNumberInRange = getNumberInRange
				callback(ctx, req)
			} catch (e) {
				console.log('xxx', e)
				if (typeof e == 'object') e = e.errmsg
				ctx.status(200).send({ code: 100, msg: e })
			}
		})
	}
	post_noauth = (url, callback) => {
		httpdata[this.name].app.post(url, bodyParser.json(), (req, ctx) => {
			try {
				ctx.respErr = respErr
				ctx.respOk = respOk
				req.getClientIp = getClientIp
				req.getString = getString
				req.getStringNotNullAndEmpty = getStringNotNullAndEmpty
				req.getStringNotNull = getStringNotNull
				req.getInt = getInt
				req.getIntWithMinValue = getIntWithMinValue
				req.getIntWithMaxValue = getIntWithMaxValue
				req.getIntInRange = getIntInRange
				req.getIntInEnum = getIntInEnum
				req.getNumber = getNumber
				req.getNumberWithMinValue = getNumberWithMinValue
				req.getNumberWithMaxValue = getNumberWithMaxValue
				req.getNumberInEnum = getNumberInEnum
				req.getNumberInRange = getNumberInRange
				callback(ctx, req)
			} catch (e) {
				if (typeof e == 'object') e = e.errmsg
				ctx.status(200).send({ code: 100, msg: e })
			}
		})
	}
	post = (url, callback) => {
		httpdata[this.name].app.post(url, bodyParser.json(), (req, ctx) => {
			ctx.respErr = respErr
			ctx.respOk = respOk
			redis_token.select(0).then(() => {
				let token = req.get('x-token')
				redis_token.get(`abuetoken:${token}`).then((tokendata) => {
					if (!tokendata) {
						ctx.respErr('未登录', {})
						return
					}
					if (tokendata.expiretime < moment().valueOf()) {
						ctx.respErr('登录已过期', {})
						return
					}
					try {
						req.getClientIp = getClientIp
						req.getString = getString
						req.getStringNotNullAndEmpty = getStringNotNullAndEmpty
						req.getStringNotNull = getStringNotNull
						req.getInt = getInt
						req.getIntWithMinValue = getIntWithMinValue
						req.getIntWithMaxValue = getIntWithMaxValue
						req.getIntInRange = getIntInRange
						req.getIntInEnum = getIntInEnum
						req.getNumber = getNumber
						req.getNumberWithMinValue = getNumberWithMinValue
						req.getNumberWithMaxValue = getNumberWithMaxValue
						req.getNumberInEnum = getNumberInEnum
						req.getNumberInRange = getNumberInRange
						callback(ctx, req, JSON.parse(tokendata))
					} catch (e) {
						if (typeof e == 'object') e = e.errmsg
						ctx.status(200).send({ code: 100, msg: e })
					}
				})
			})
		})
	}
	upload = (url, callback) => {
		httpdata[this.name].app.post(url, mutipartMiddeware, (req, ctx) => {
			ctx.respErr = respErr
			ctx.respOk = respOk
			redis_token.select(0).then(() => {
				let token = req.get('x-token')
				redis_token.get(`abuetoken:${token}`).then((tokendata) => {
					if (!tokendata) {
						ctx.respErr('未登录', {})
						return
					}
					if (tokendata.expiretime < moment().valueOf()) {
						ctx.respErr('登录已过期', {})
						return
					}
					try {
						req.getClientIp = getClientIp
						req.getString = getString
						req.getStringNotNullAndEmpty = getStringNotNullAndEmpty
						req.getStringNotNull = getStringNotNull
						req.getInt = getInt
						req.getIntWithMinValue = getIntWithMinValue
						req.getIntWithMaxValue = getIntWithMaxValue
						req.getIntInRange = getIntInRange
						req.getIntInEnum = getIntInEnum
						req.getNumber = getNumber
						req.getNumberWithMinValue = getNumberWithMinValue
						req.getNumberWithMaxValue = getNumberWithMaxValue
						req.getNumberInEnum = getNumberInEnum
						req.getNumberInRange = getNumberInRange
						callback(ctx, req, JSON.parse(tokendata))
					} catch (e) {
						if (typeof e == 'object') e = e.errmsg
						ctx.status(200).send({ code: 100, msg: e })
					}
				})
			})
		})
	}
	upload_noauth = (url, callback) => {
		httpdata[this.name].app.post(url, mutipartMiddeware, (req, ctx) => {
			try {
				ctx.respErr = respErr
				ctx.respOk = respOk
				req.getClientIp = getClientIp
				req.getString = getString
				req.getStringNotNullAndEmpty = getStringNotNullAndEmpty
				req.getStringNotNull = getStringNotNull
				req.getInt = getInt
				req.getIntWithMinValue = getIntWithMinValue
				req.getIntWithMaxValue = getIntWithMaxValue
				req.getIntInRange = getIntInRange
				req.getIntInEnum = getIntInEnum
				req.getNumber = getNumber
				req.getNumberWithMinValue = getNumberWithMinValue
				req.getNumberWithMaxValue = getNumberWithMaxValue
				req.getNumberInEnum = getNumberInEnum
				req.getNumberInRange = getNumberInRange
				callback(ctx, req)
			} catch (e) {
				if (typeof e == 'object') e = e.errmsg
				ctx.status(200).send({ code: 100, msg: e })
			}
		})
	}
}

module.exports = {}
let connect_redis
connect_redis = function (rediscfgs, index, callback) {
	if (!rediscfgs || rediscfgs.length == 0 || rediscfgs.length == index) {
		callback()
		return
	}

	let url
	if (rediscfgs[index].password && rediscfgs[index].length > 0) {
		url = `redis://:${rediscfgs[index].password}@${rediscfgs[index].host}:${rediscfgs[index].port}`
	} else {
		url = `redis://${rediscfgs[index].host}:${rediscfgs[index].port}`
	}
	let connection = redis.createClient({ url })
	connection.on('error', (err) => console.log(`Redis连接失败:[${rediscfgs[index].name}:${rediscfgs[index].host}:${rediscfgs[index].port}]`))
	connection.name = rediscfgs[index].name
	connection.subscribe = function (channel, callback) {
		redisdata[`sub${this.name}`].subscribe(channel, (message) => {
			try {
				message = JSON.parse(message)
				callback(message)
			} catch (e) {
				callback(message)
			}
		})
	}
	connection.unsubscribe = function (channel) {
		redisdata[`sub${this.name}`].unsubscribe(channel)
	}
	connection.publish = function (channel, value) {
		if (typeof value === 'object') {
			value = JSON.stringify(value)
		}
		redisdata[`pub${this.name}`].publish(channel, value)
	}
	connection.connect().then(() => {
		setInterval(() => {
			connection.ping()
		}, 5000)
		let subconnection = redis.createClient({ url: `redis://${rediscfgs[index].host}:${rediscfgs[index].port}` })
		subconnection.on('error', (err) => console.log(`Redis连接失败:[${rediscfgs[index].name}:${rediscfgs[index].host}:${rediscfgs[index].port}]`))
		subconnection.connect().then(() => {
			subconnection.subscribe(`__ping__${rediscfgs[index].name}`, (msg) => {})
			let pubconnection = redis.createClient({ url: `redis://${rediscfgs[index].host}:${rediscfgs[index].port}` })
			pubconnection.on('error', (err) => console.log(`Redis连接失败:[${rediscfgs[index].name}:${rediscfgs[index].host}:${rediscfgs[index].port}]`))
			pubconnection.connect().then(() => {
				setInterval(() => {
					pubconnection.publish(`__ping__${rediscfgs[index].name}`, 'ping')
				}, 5000)
				redisdata[`sub${rediscfgs[index].name}`] = subconnection
				redisdata[`pub${rediscfgs[index].name}`] = pubconnection
				module.exports[rediscfgs[index].name] = connection
				console.log(`Redis连接成功:[${rediscfgs[index].name}:${rediscfgs[index].host}:${rediscfgs[index].port}]`)
				connect_redis(rediscfgs, index + 1, callback)
			})
		})
	})
}
let dbdata = {}
let connect_db
connect_db = function (dbcfgs, index, subidx, callback) {
	if (dbcfgs.length == index) {
		callback()
		return
	}
	dbcfgs[index].count = dbcfgs[index].count || 1
	if (subidx == dbcfgs[index].count) {
		connect_db(dbcfgs, index + 1, 0, callback)
		return
	}
	let key = `${dbcfgs[index].name}_${subidx}`
	let db = mysql.createConnection(dbcfgs[index])
	db.connect((err) => {
		if (err) {
			setTimeout(() => {
				console.log(`连接数据库失败:[${dbcfgs[index].name}:${dbcfgs[index].host}:${dbcfgs[index].port}:${dbcfgs[index].database}:${subidx}]`)
				delete dbdata[key]
				connect_db(dbcfgs, index, subidx, callback)
			}, 10000)
		} else {
			pingInterval = setInterval(() => {
				db.ping((err) => {
					if (err) {
						console.log(`连接数据库断开连接:[${dbcfgs[index].name}:${dbcfgs[index].host}:${dbcfgs[index].port}:${dbcfgs[index].database}]:${subidx}`)
						delete dbdata[key]
						connect_db(dbcfgs, index, subidx, callback)
					}
				})
			}, 10000)
			db.on('error', () => {
				console.log(`连接数据库失败:[${dbcfgs[index].name}:${dbcfgs[index].host}:${dbcfgs[index].port}:${dbcfgs[index].database}:${subidx}]`)
				delete dbdata[key]
				connect_db(dbcfgs, index, subidx, callback)
			})
			dbdata[key] = db
			console.log(`连接数据库成功:[${dbcfgs[index].name}:${dbcfgs[index].host}:${dbcfgs[index].port}:${dbcfgs[index].database}:${subidx}]`)
			connect_db(dbcfgs, index, subidx + 1, callback)
		}
	})
}

function dbexectue(sql, params, ctx, callback) {
	if (typeof ctx == 'function') {
		callback = ctx
		ctx = null
	}
	if (typeof params == 'function') {
		callback = params
		params = {}
		ctx = null
	}
	let db = null
	for (let i = 0; i < 10; i++) {
		let subidx = Math.floor(Math.random() * 10000) % this.count
		db = dbdata[`${this.name}_${subidx}`]
		if (db) break
	}
	if (db == null) {
		console.log(`执行数据库失败,无可用数据连接:[${sql}][${JSON.stringify(params)}]`)
		return
	}
	db.query(sql, params, (err, result) => {
		if (err) {
			let message = err.message
			if (!message) {
				message = err.sqlMessage
			}
			console.log(message)
			if (ctx) {
				throw { ctx: ctx, errmsg: message }
			}
		}
		if (callback) callback(result)
	})
}

function dbcallProc(name, params, ctx, callback) {
	if (typeof ctx == 'function') {
		callback = ctx
		ctx = null
	}
	if (typeof params == 'function') {
		callback = params
		params = {}
		ctx = null
	}
	let sql = 'call ' + name + '('
	for (let i = 0; i < params.length; i++) {
		sql += '?'
		if (i < params.length - 1) {
			sql += ','
		}
	}
	sql += ')'
	if (typeof ctx == 'function') {
		callback = ctx
		ctx = null
	}
	let db = null
	for (let i = 0; i < 10; i++) {
		let subidx = Math.floor(Math.random() * 10000) % this.count
		db = dbdata[`${this.name}_${subidx}`]
		if (db) break
	}
	if (db == null) {
		console.log(`执行数据库失败,无可用数据连接:[${sql}][${JSON.stringify(params)}]`)
		return
	}
	db.query(sql, params, (err, result) => {
		if (err) {
			let message = err.message
			if (!message) {
				message = err.sqlMessage
			}
			if (ctx) {
				throw { ctx: ctx, errmsg: message }
			}
			console.log(message)
		}
		if (callback) {
			result = result || {}
			let r = result[0] || {}
			let s = r[0] || r
			s = s || {}
			if (s.errmsg) {
				console.log(s.errmsg)
				if (ctx) throw { ctx: ctx, errmsg: s.errmsg }
				return
			}
			callback(s)
		}
	})
}

function dbgetPageData(table, where, page, pagesize, ctx, callback) {
	if (typeof ctx == 'function') {
		callback = ctx
		ctx = null
	}
	if (page == undefined || page == null || page < 1) {
		page = 1
	}
	if (pagesize == undefined || pagesize == null || pagesize < 1) {
		pagesize = 1
	}
	where.sqlex = where.sqlex || ''
	where.sql = where.sql || ''
	let count = (page - 1) * pagesize
	if (where.sql.length > 0) where.sql = 'and ' + where.sql
	let sql = `SELECT * FROM ${table} WHERE id <= (SELECT id FROM ${table} ${where.sqlex} ORDER BY id DESC LIMIT ?,1) ${where.sql} ORDER BY id DESC LIMIT ?`
	let params = []
	if (where.params) {
		params = JSON.parse(JSON.stringify(where.params))
	}
	params.push(count)
	if (where.params) {
		params = params.concat(where.params)
	}
	params.push(pagesize)
	this.exectue(sql, params, ctx, (data) => {
		sql = `select count(id) as total from ${table} ${where.sqlex}`
		this.exectue(sql, where.params, ctx, (result) => {
			callback({ total: result[0].total, data: data, page: page, pagesize: pagesize })
		})
	})
}

function dbmakeWhere(where, andor, field, o, data) {
	where.sqlex = where.sqlex || ''
	where.sql = where.sql || ''
	where.params = where.params || []
	if (data == null || data == undefined) return
	if (typeof data == 'string' && data.length == 0) return
	if (where.sqlex.length == 0) where.sqlex += 'where '
	if (where.sqlex != 'where ') where.sqlex += ` ${andor} `
	if (where.sql.length != 0) where.sql += ` ${andor} `

	where.sqlex += field
	where.sqlex += ' '
	where.sqlex += o
	where.sqlex += ' ? '

	where.sql += field
	where.sql += ' '
	where.sql += o
	where.sql += ' ? '
	where.params.push(data)
}
function wssendmsg(msgid, data) {
	let senddata = {
		msgid: msgid,
		data: data,
	}
	this.sendmsg(JSON.stringify(senddata))
}
let wsdata = {}
class bws {
	constructor(name, port) {
		this.name = name
		let data = {}
		data.msg_callback = {}
		wsdata[name] = data
		if (port) {
			data.listener = new WebSocket.Server({ port: port })
			data.listener.on('connection', (connection, req) => {
				let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || ''
				if (ip == '::1') ip = '127.0.0.1'
				ip = ip.match(/\d+.\d+.\d+.\d+/)
				ip = ip ? ip.join('.') : null
				connection.ip = ip
				connection.sendmsg = connection.send
				connection.send = wssendmsg
				connection.on('message', (recvdata) => {
					if (typeof recvdata != 'string') {
						recvdata = recvdata.toString('utf-8')
					}
					try {
						recvdata = JSON.parse(recvdata)
						if (recvdata.msgid && data.msg_callback[recvdata.msgid]) {
							data.msg_callback[recvdata.msgid](connection, recvdata.data)
						}
					} catch (e) {}
				})
				connection.send_msg = (msgid, data) => {
					let senddata = {
						msgid: msgid,
						data: data,
					}
					connection.send(JSON.stringify(senddata))
				}
				connection.on('close', () => {
					if (data.close_callback) {
						data.close_callback(connection)
					}
				})
				if (data.connection_callback) {
					data.connection_callback(connection)
				}
			})
			console.log(`开启服务[${name}]:`, port)
		}
	}
	close = (connection) => {
		connection.close()
	}
	addConnectCallback = (callback) => {
		wsdata[this.name].connection_callback = callback
	}
	addMsgCallback = (msgid, callback) => {
		wsdata[this.name].msg_callback[msgid] = callback
	}
	addCloseCallback = (callback) => {
		wsdata[this.name].close_callback = callback
	}
	connect = (host, callback) => {
		let connection = new WebSocket(host)
		connection.connected = false
		connection.on('open', () => {
			connection.connected = true
			connection.sendmsg = connection.send
			connection.send = wssendmsg
			callback(connection)
		})
		connection.on('error', () => {
			if (!connection.connected) {
				callback()
			}
		})
		connection.on('close', () => {
			if (wsdata[this.name].close_callback) {
				wsdata[this.name].close_callback(connection)
			}
		})
		connection.on('message', (recvdata) => {
			if (typeof recvdata != 'string') {
				recvdata = recvdata.toString('utf-8')
			}
			try {
				recvdata = JSON.parse(recvdata)
				if (recvdata.msgid && wsdata[this.name].msg_callback[recvdata.msgid]) {
					wsdata[this.name].msg_callback[recvdata.msgid](connection, recvdata.data)
				}
			} catch (e) {}
		})
	}
}

module.exports.setToken = (token, data) => {
	data.expiretime = moment().add(7, 'days').valueOf() + 1
	redis_token.select(0).then(() => {
		redis_token.set(`abuetoken:${token}`, JSON.stringify(data))
	})
}

module.exports.delToken = (token) => {
	redis_token.select(0).then(() => {
		redis_token.del(`abuetoken:${token}`)
	})
}

module.exports.init = (cfg, callback) => {
	logger.level = cfg.log.level
	let dbready
	let dbreadyed = false
	if (cfg.db && cfg.db.length > 0) {
		connect_db(cfg.db, 0, 0, () => {
			dbready()
		})
		for (let i = 0; i < cfg.db.length; i++) {
			module.exports[cfg.db[i].name] = {}
			module.exports[cfg.db[i].name].count = cfg.db[i].count
			module.exports[cfg.db[i].name].name = cfg.db[i].name
			module.exports[cfg.db[i].name].exectue = dbexectue
			module.exports[cfg.db[i].name].callProc = dbcallProc
			module.exports[cfg.db[i].name].getPageData = dbgetPageData
			module.exports[cfg.db[i].name].makeWhere = dbmakeWhere
		}
	} else {
		dbreadyed = true
	}
	dbready = () => {
		let tokenredisready
		let tokenredisreadyed = false
		if (cfg.token) {
			let url
			if (cfg.token.password && cfg.token.password.length > 0) {
				url = `redis://:${cfg.token.password}@${cfg.token.host}:${cfg.token.port}`
			} else {
				url = `redis://${cfg.token.host}:${cfg.token.port}`
			}
			redis_token = redis.createClient({ url })
			redis_token.on('error', (err) => console.log(`Redis连接失败:[token:${cfg.token.host}:${cfg.token.port}]`))
			redis_token.connect().then(function () {
				console.log(`Redis连接成功:[token:${cfg.token.host}:${cfg.token.port}]`)
				redis_token.select(1)
				setInterval(() => {
					redis_token.ping()
				}, 5000)
				tokenredisready()
			})
		} else {
			tokenredisreadyed = true
		}
		tokenredisready = () => {
			connect_redis(cfg.redis, 0, () => {
				if (cfg.http && cfg.http.length > 0) {
					for (let i = 0; i < cfg.http.length; i++) {
						module.exports[cfg.http[i].name] = new bhttp(cfg.http[i].name, cfg.http[i].port)
					}
				}
				if (cfg.ws && cfg.ws.length > 0) {
					for (let i = 0; i < cfg.ws.length; i++) {
						module.exports[cfg.ws[i].name] = new bws(cfg.ws[i].name, cfg.ws[i].port)
					}
				}
				callback()
			})
		}
		if (tokenredisreadyed) tokenredisready()
	}
	if (dbreadyed) dbready()
}

module.exports.clone = (obj) => {
	return JSON.parse(JSON.stringify(obj))
}
//[minNum, maxNum)
module.exports.rand = (minNum, maxNum) => {
	if ((typeof minNum == 'number' && typeof minNum == 'number' && minNum != null) || (minNum != undefined && maxNum != null && maxNum != undefined && minNum < maxNum)) {
		if (minNum == maxNum) return minNum
		return parseInt(Math.random() * (maxNum - minNum) + minNum, 10)
	}
}

module.exports.guid = (mask) => {
	mask = mask || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
	return mask.replace(/[xy]/g, function (c) {
		let r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

module.exports.getIpLocation = (ip) => {
	return qqwry.searchIP(ip).Country
}
module.exports.getGoogleAuthKey = (len) => {
	len = len || 32
	if (len < 8) len = 0
	if (len > 64) len = 64
	return googleAuth.createSecret(len)
}

module.exports.getGoogleAuthCode = (key) => {
	if (!key) return null
	return googleAuth.getCode(key)
}

module.exports.sha1 = (data) => {
	return crypto.createHash('sha1').update(data).digest('hex')
}

module.exports.getSign = (data, secret) => {
	let keys = []
	for (let i in data) {
		keys.push(i)
	}
	keys.sort((a, b) => {
		if (a == b) return 0
		return a < b ? -1 : 1
	})
	let str = ''
	for (let i = 0; i < keys.length; i++) {
		str += data[keys[i]]
	}
	str += secret
	return crypto.createHash('sha1').update(str).digest('hex')
}

module.exports.axios = axios
