const server = require('abue')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const { emitKeypressEvents } = require('readline')
let config
let user_leave_callback = null
let users = {}
let RoomId
function init(icfg) {
	config = icfg
	let strgameid = `${config.gameid}`
	let strroomid = `${config.roomlevel}`
	let strcurrency = `${config.currency}`
	if (strroomid.length == 1) strroomid = '0' + strroomid
	if (strcurrency.length == 1) strcurrency = '0' + strcurrency
	RoomId = strgameid + strroomid + strcurrency
}
function getControlData(userinfo) {
	let sql = 'select * from x_user_control where UserId = ?'
	server.db.exectue(sql, [userinfo.UserId], (controldata) => {
		if (controldata.length == 0) return
		controldata = controldata[0]
		if (controldata.FinishPercent >= 100) return
		if (controldata.State == 0) return
		if (controldata.ControlLevel == 0) return
		if (controldata.StartScore > controldata.DestScore && (controldata.State != 2 || controldata.ControlLevel > 0)) return
		if (controldata.StartScore < controldata.DestScore && (controldata.State != 1 || controldata.ControlLevel < 0)) return
		delete controldata.UserId
		userinfo.control = controldata
		server.setToken(userinfo.Token, userinfo)
	})
}
server.ws.addMsgCallback('login', (ctx, data) => {
	if (!data.Token) {
		ctx.send('login_result', { errcode: 0, errmsg: '参数错误' })
		return
	}
	let tokenkey = `GameLoginToken:${data.Token}`
	server.redis.get(tokenkey).then((tokendata) => {
		if (!tokendata) {
			ctx.send('login_result', { errcode: 0, errmsg: '登录失败,token验证失败' })
			return
		}
		server.redis.del(tokenkey)
		tokendata = JSON.parse(tokendata)
		if (tokendata.GameId != config.gameid) {
			ctx.send('login_result', { errcode: 0, errmsg: '登录失败,游戏Id不匹配' })
			return
		}
		if (tokendata.CurrencyType != config.currency) {
			ctx.send('login_result', { errcode: 0, errmsg: '登录失败,币种不匹配' })
			return
		}
		let sql = 'select GameToken as Token,Custom,Score,Currency from x_user where UserId = ?'
		server.db.exectue(sql, [tokendata.UserId], ctx, (result) => {
			let authdata = result[0]
			if (authdata.Token) {
				server.delToken(authdata.Token)
			}
			if (tokendata.CurrencyType != authdata.Currency) {
				ctx.send('login_result', { errcode: 0, errmsg: '登录失败,币种不匹配' })
				return
			}
			let CurrencyType = tokendata.CurrencyType
			let UserId = tokendata.UserId
			let SellerId = tokendata.SellerId
			tokendata = {}
			tokendata.Score = authdata.Score
			tokendata.SellerId = SellerId
			tokendata.UserId = UserId
			tokendata.CurrencyType = CurrencyType
			tokendata.Token = server.guid()
			tokendata.Custom = authdata.Custom
			server.setToken(tokendata.Token, tokendata)
			getControlData(tokendata)
			sql = 'update x_user set GameLoginToken = null,GameToken = ? where UserId = ?'
			server.db.exectue(sql, [tokendata.Token, tokendata.UserId], ctx, () => {
				ctx.token = tokendata.Token
				ctx.UserId = tokendata.UserId
				users[tokendata.UserId] = ctx
				ctx.send('login_result', { Score: tokendata.Score })
			})
		})
	})
})
//玩家信息,score金币变化值,gamedata游戏记录,taxscore税收
function writeSocre(userinfo, serial, betscore, winscore, flowscore, gamerecord, taxscore, callback) {
	if (typeof taxscore == 'function') {
		callback = taxscore
		taxscore = 0
	}
	userinfo.Score += winscore
	server.setToken(userinfo.Token, userinfo)
	let userdata = [
		{
			UserId: userinfo.UserId,
			SellerId: userinfo.SellerId,
			Custom: userinfo.Custom,
			WinScore: winscore,
			BetScore: betscore,
			FlowScore: flowscore,
			TaxScore: taxscore,
			TotalScore: userinfo.Score,
		},
	]
	let procdata = [RoomId, config.serverid, serial, config.currency, JSON.stringify(gamerecord), JSON.stringify(userdata)]
	server.db.callProc('x_Game_WriteScore', procdata, () => {
		module.exports.updateUserControl(userinfo)
		callback()
	})
}
//serial 牌局号,gamerecord对局详情,结算数据userdata[userinfo,BetScore,WinScore,FlowScore,TaxScore]
function writeSocreEx(serial, gamerecord, userdata, callback) {
	let puserdata = []
	for (let i = 0; i < userdata.length; i++) {
		let ud = userdata[i]
		ud.userinfo.Score += ud.WinScore
		server.setToken(ud.userinfo.Token, ud.userinfo)
		let data = {
			UserId: ud.userinfo.UserId,
			SellerId: ud.userinfo.SellerId,
			Custom: ud.userinfo.Custom,
			WinScore: ud.WinScore,
			BetScore: ud.BetScore,
			FlowScore: ud.FlowScore,
			TaxScore: ud.TaxScore,
			TotalScore: ud.userinfo.Score,
		}
		puserdata.push(data)
	}
	let procdata = [RoomId, config.serverid, serial, config.currency, JSON.stringify(gamerecord), JSON.stringify(puserdata)]
	server.db.callProc('x_Game_WriteScore', procdata, () => {
		for (let i = 0; i < userdata.length; i++) {
			module.exports.updateUserControl(userdata[i].userinfo)
		}
		callback()
	})
}
function getSerial(callback) {
	server.db.callProc('x_GameServer_GetSerial', (result) => {
		callback(result.Serial)
	})
}
function addMsgCallback(msgid, callback) {
	server.ws.addMsgCallback(msgid, (ctx, data) => {
		if (!ctx.token) {
			server.ws.close(ctx)
			return
		}
		server.getToken(ctx.token, (tokendata) => {
			if (!tokendata) {
				ctx.send(msgid, { errcode: 0, errmsg: '未登录' })
				return
			}
			callback(ctx, data, tokendata)
		})
	})
}
server.ws.addCloseCallback((ctx) => {
	if (!ctx.token) return
	if (ctx.UserId) delete users[ctx.UserId]
	if (user_leave_callback) {
		server.getToken(ctx.token, (tokendata) => {
			server.delToken(ctx.token)
			if (!tokendata) return
			user_leave_callback(tokendata)
		})
	}
})
function addUserLeaveCallback(callback) {
	user_leave_callback = callback
}
function saveUserData(userinfo, savekey, data) {
	let sql = `replace into x_saved_data(UserId,SaveKey,data)values(?,?,?)`
	server.db.exectue(sql, [userinfo.UserId, savekey, JSON.stringify(data)], () => {})
}
function getUserData(userinfo, savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = ? and GameId = 0 and RoomLevel = 0 and ServerId = 0 and SaveKey = ?'
	server.db.exectue(sql, [userinfo.UserId, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveUserGameData(userinfo, savekey, data) {
	let sql = `replace into x_saved_data(UserId,Gameid,SaveKey,data)values(?,?,?,?)`
	server.db.exectue(sql, [userinfo.UserId, config.gameid, savekey, JSON.stringify(data)], () => {})
}
function getUserGameData(userinfo, savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = ? and GameId = ? and RoomLevel = 0 and ServerId = 0 and SaveKey = ?'
	server.db.exectue(sql, [userinfo.UserId, config.gameid, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveUserRoomData(userinfo, savekey, data) {
	let sql = `replace into x_saved_data(UserId,Gameid,RoomLevel,SaveKey,data)values(?,?,?,?,?)`
	server.db.exectue(sql, [userinfo.UserId, config.gameid, config.roomlevel, savekey, JSON.stringify(data)], () => {})
}
function getUserRoomData(userinfo, savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = ? and GameId = ? and RoomLevel = ? and ServerId = 0 and SaveKey = ?'
	server.db.exectue(sql, [userinfo.UserId, config.gameid, config.roomlevel, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveUserServerData(userinfo, savekey, data) {
	let sql = `replace into x_saved_data(UserId,Gameid,RoomLevel,ServerId,SaveKey,data)values(?,?,?,?,?,?)`
	server.db.exectue(sql, [userinfo.UserId, config.gameid, config.roomlevel, config.serverid, savekey, JSON.stringify(data)], () => {})
}
function getUserServerData(userinfo, savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = ? and GameId = ? and RoomLevel = ? and ServerId = ? and SaveKey = ?'
	server.db.exectue(sql, [userinfo.UserId, config.gameid, config.roomlevel, config.serverid, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveData(savekey, data) {
	let sql = `replace into x_saved_data(SaveKey,data)values(?,?)`
	server.db.exectue(sql, [savekey, JSON.stringify(data)], () => {})
}
function getData(savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = 0 and GameId = 0 and RoomLevel = 0 and ServerId = 0 and SaveKey = ?'
	server.db.exectue(sql, [savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveGameData(savekey, data) {
	let sql = `replace into x_saved_data(Gameid,SaveKey,data)values(?,?,?)`
	server.db.exectue(sql, [config.gameid, savekey, JSON.stringify(data)], () => {})
}
function getGameData(savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = 0 and GameId = ? and RoomLevel = 0 and ServerId = 0 and SaveKey = ?'
	server.db.exectue(sql, [config.gameid, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveRoomData(savekey, data) {
	let sql = `replace into x_saved_data(Gameid,RoomLevel,SaveKey,data)values(?,?,?,?)`
	server.db.exectue(sql, [config.gameid, config.roomlevel, savekey, JSON.stringify(data)], () => {})
}
function getRoomData(savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = 0 and GameId = ? and RoomLevel = ? and ServerId = 0 and SaveKey = ?'
	server.db.exectue(sql, [config.gameid, config.roomlevel, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function saveServerData(savekey, data) {
	let sql = `replace into x_saved_data(UserId,Gameid,RoomLevel,ServerId,SaveKey,data)values(?,?,?,?,?,?)`
	server.db.exectue(sql, [0, config.gameid, config.roomlevel, config.serverid, savekey, JSON.stringify(data)], () => {})
}
function getServerData(savekey, callback) {
	let sql = 'select data from x_saved_data where UserId = 0 and GameId = ? and RoomLevel = ? and ServerId = ? and SaveKey = ?'
	server.db.exectue(sql, [config.gameid, config.roomlevel, config.serverid, savekey], (data) => {
		if (data.length == 0) {
			data = null
		} else {
			data = data[0].data
		}
		if (data == null) data = '{}'
		data = JSON.parse(data)
		callback(data)
	})
}
function randomIntRange(minNum, maxNum) {
	return parseInt(Math.random() * (maxNum - minNum) + minNum, 10)
}
function getXSetting(settingname, callback) {
	let sql = `select SettingValue from x_setting where SettingName = ?`
	server.db.exectue(sql, [settingname], (data) => {
		if (data.length == 0) {
			callback()
			return
		}
		callback(data[0].SettingValue)
	})
}
function getGameId() {
	return config.gameid
}
function getRoomLevel() {
	return config.roomlevel
}
function getServerId() {
	return config.serverid
}
function updateUserControl(userinfo) {
	if (!userinfo.control) return
	if (userinfo.control.DestScore > userinfo.control.StartScore) {
		userinfo.control.FinishPercent = (userinfo.Score - userinfo.control.StartScore) / (userinfo.control.DestScore - userinfo.control.StartScore)
	}
	if (userinfo.control.DestScore < userinfo.control.StartScore) {
		userinfo.control.FinishPercent = (userinfo.control.StartScore - userinfo.Score) / (userinfo.control.StartScore - userinfo.control.DestScore)
	}
	userinfo.control.FinishPercent = Math.floor(userinfo.control.FinishPercent * 10000)
	userinfo.control.FinishPercent = parseFloat(userinfo.control.FinishPercent / 10000)
	let sql = 'update x_user_control set Score = ?,FinishPercent = ?,UpdateTime = now() where UserId = ?'
	server.db.exectue(sql, [userinfo.Score, userinfo.control.FinishPercent, userinfo.UserId], () => {})
	if (userinfo.control.FinishPercent >= 1) {
		delete userinfo.control
		sql = 'update x_user_control set State = 0,UpdateTime = now() where UserId = ?'
		server.db.exectue(sql, [userinfo.UserId], () => {})
	}
}
function __getRoomConfig(callback) {
	let sql = 'select config from x_game_room where GameId = ? and  RoomLevel = ? and Currency = ? '
	server.db.exectue(sql, [config.gameid, config.roomlevel, config.currency], (dbresult) => {
		if (dbresult.length > 0) {
			dbresult = dbresult[0]
			callback(JSON.parse(dbresult.config))
		} else {
			callback({})
		}
	})
}
function getRoomConfig(callback) {
	__getRoomConfig(callback)
	setInterval(() => {
		__getRoomConfig(callback)
	}, 60000)
}
function __getBlackWhiteDefine(callback) {
	let sql = `select SettingValue from x_setting where SettingName = ?`
	server.db.exectue(sql, ['SlotBlackWhileDefine'], (data) => {
		if (data.length == 0) {
			callback({})
			return
		}
		callback(JSON.parse(data[0].SettingValue))
	})
}
function getBlackWhiteDefine(callback) {
	__getBlackWhiteDefine(callback)
	setInterval(() => {
		__getBlackWhiteDefine(callback)
	}, 60000)
}
let slotgameconfig
let slotgroupinfo
let slotsampledb
let slotsamplerecord = {} //样本记录
let slotsampledata = {} //样本数据
let slotblackdata
let slotwhitedata
let slotrtp
let slotsamplenum
let slotblackwhitedefine
function slotInit(gameconfig) {
	slotgameconfig = gameconfig
	if (gameconfig.sampletype == 'db') {
		let dbfile = './sample.db'
		if (fs.existsSync(dbfile)) {
			slotsampledb = new sqlite3.Database(dbfile)
		} else {
			dbfile = './game/sample.db'
			if (fs.existsSync(dbfile)) {
				slotsampledb = new sqlite3.Database(dbfile)
			}
		}
		if (slotsampledb) {
			slotsampledb.serialize(() => {
				slotsampledb.each(`select data from info where info = 'info'`, (err, data) => {
					slotgroupinfo = JSON.parse(data.data)
				})
			})
		} else {
			console.log('打开Slot样本失败')
		}
	}
	if (gameconfig.sampletype == 'file') {
		fs.readFile('./game/data/info.txt', (err, data) => {
			if (!err) {
				slotgroupinfo = JSON.parse(data.toString('utf-8'))
			} else {
				console.log('打开Slot样本失败')
			}
		})
	}
	module.exports.getRoomConfig((roomconfig) => {
		slotrtp = roomconfig.rtp
		slotsamplenum = roomconfig.samplenum
		slotrtp = slotrtp || 80
		slotsamplenum = slotsamplenum || 1
	})
	module.exports.getBlackWhiteDefine((blackwhite) => {
		slotblackwhitedefine = blackwhite
	})
	slotinited = true
}
function slotGetSampleData(stype, betscore, callback) {
	if (!slotgameconfig) return
	let datakey = `${stype}_${slotrtp}_${betscore}`
	if (!slotsamplerecord[datakey]) {
		module.exports.getServerData(datakey, (data) => {
			data.groupindex = data.groupindex || 0
			data.sampleindex = data.sampleindex || 0
			slotsamplerecord[datakey] = data
			slotGetSampleData(stype, betscore, callback)
		})
		return
	}
	let record = slotsamplerecord[datakey]
	if (slotgameconfig.sampletype == 'file' && !slotsampledata[datakey]) {
		fs.readFile(`./game/data/${stype}_rtp_${slotsamplenum}_${slotrtp}_${record.groupindex}.txt`, (err, filedata) => {
			slotsampledata[datakey] = JSON.parse(filedata.toString('utf-8'))
			slotGetSampleData(stype, betscore, callback)
		})
		return
	}
	if (record.sampleindex >= slotgroupinfo.group_count) {
		record.groupindex = gameserver.randomIntRange(0, slotgroupinfo.group)
		record.sampleindex = 0
	}
	if (slotgameconfig.sampletype == 'file') {
		callback(slotsampledata[datakey].data[record.sampleindex].data)
	}
	if (slotgameconfig.sampletype == 'db') {
		slotsampledb.serialize(() => {
			let sql = `select data from ${stype}_rtp_${slotsamplenum}_${slotrtp}_${record.groupindex} where id = ${record.sampleindex + 1}`
			if (stype == 'buy') {
				sql = `select data from ${stype}_rtp_${slotsamplenum}_${slotrtp} where id = ${record.sampleindex + 1}`
			}
			slotsampledb.each(sql, (err, data) => {
				callback(JSON.parse(data.data))
			})
		})
	}
	record.sampleindex++
	module.exports.saveServerData(datakey, record)
}
function slotGetBlackSampleData(callback) {
	let idx = module.exports.randomIntRange(0, slotgroupinfo.group_count - 1)
	if (slotgameconfig.sampletype == 'file') {
		if (!slotblackdata) {
			fs.readFile('./game/data/black.txt', (err, data) => {
				slotblackdata = JSON.parse(data.toString('utf-8'))
				slotGetBlackSampleData(callback)
			})
			return
		}
		callback(slotblackdata[idx])
	}
	if (slotgameconfig.sampletype == 'db') {
		slotsampledb.serialize(() => {
			slotsampledb.each(`select data from black where id = ${idx + 1}`, (err, data) => {
				callback(JSON.parse(data.data))
			})
		})
	}
}
function slotGetWhiteSampleData(callback) {
	let idx = module.exports.randomIntRange(0, slotgroupinfo.group_count - 1)
	if (slotgameconfig.sampletype == 'file') {
		if (!slotwhitedata) {
			fs.readFile(`./game/data/white_${slotsamplenum}_${slotrtp}.txt`, (err, data) => {
				slotwhitedata = JSON.parse(data.toString('utf-8'))
				slotGetWhiteSampleData(callback)
			})
			return
		}
		callback(slotwhitedata[idx])
	}
	if (slotgameconfig.sampletype == 'db') {
		slotsampledb.serialize(() => {
			slotsampledb.each(`select data from white_${slotsamplenum}_${slotrtp} where id = ${idx + 1}`, (err, data) => {
				callback(JSON.parse(data.data))
			})
		})
	}
}

function getControlSampleData(userinfo, callback) {
	if (!userinfo.control) {
		callback()
	} else {
		let percent = slotblackwhitedefine[userinfo.control.ControlLevel]
		if (!percent) {
			callback()
		} else {
			if (module.exports.randomIntRange(0, 100 - 1) > Math.floor(percent * 100)) {
				callback()
			} else {
				if (userinfo.control.ControlLevel < 0) {
					module.exports.slotGetBlackSampleData(callback)
				}
				if (userinfo.control.ControlLevel > 0) {
					module.exports.slotGetWhiteSampleData(callback)
				}
			}
		}
	}
}

module.exports = {
	init, //初始化服务器
	writeSocre, //单个玩家写分
	writeSocreEx, //批量写分
	getSerial, //获取游戏牌局号
	addMsgCallback, //监听游戏消息回调
	addUserLeaveCallback, //监听玩家离开消息
	saveUserData, //保存玩家级数据,任何游戏,任何房间,任何服务器共用
	getUserData, //获取玩家级数据,任何游戏,任何房间,任何服务器共用
	saveUserGameData, //保存玩家游戏级数据,同一个游戏,不同房间,不同服务器共用
	getUserGameData, //获取玩家游戏级数据,同一个游戏,不同房间,不同服务器共用
	saveUserRoomData, //保存玩家游房间级数据,同一个游戏,同一个房间,不同服务器共用
	getUserRoomData, //获取玩家游房间级数据,同一个游戏,同一个房间,不同服务器共用
	getUserServerData, //保存玩家服务器级数据,同一个游戏,同一个房间,同一个服务器
	saveUserServerData, //获取玩家服务器级数据,同一个游戏,同一个房间,同一个服务器
	saveData, //保存数据,全局共用
	getData, //获取数据,全局共用
	saveGameData, //保存数据,游戏共用
	getGameData, //获取数据,游戏共用
	saveRoomData, //保存数据,房间共用
	getRoomData, //获取数据,房间共用
	saveServerData, //保存数据,服务器共用
	getServerData, //获取数据,服务器共用
	randomIntRange, //范围内随机[min,max]
	getXSetting, //获取设置
	getGameId, //获取游戏id
	getRoomLevel, //获取房间等级
	getServerId, //获取服务器id
	updateUserControl, //更新个控数据
	getRoomConfig, //获取房间配置
	getBlackWhiteDefine, //获取黑白名单定义
	slotInit, //初始化slot
	slotGetSampleData, //获得slot旋转样本
	slotGetBlackSampleData, //获取黑名单样本
	slotGetWhiteSampleData, //获取白名单样本
	getControlSampleData, //获取受控样本
}
