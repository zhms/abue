module.exports = {
	log: { level: 'trace' },
	http: [
		{
			name: '',
			port: 0,
		},
	],
	token: {
		host: '',
		port: 0,
	},
	redis: [
		{
			name: 'redis',
			host: '',
			port: 0,
		},
	],
	db: [
		{
			name: '',
			count: 10, //连接池个数
			host: '',
			port: 0,
			user: '',
			password: '',
			database: '',
		},
	],
	ws: [{ name: 'ws', port: 0 }],
}
