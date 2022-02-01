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
			host: '',
			port: 0,
			user: '',
			password: '',
			database: '',
			count: 10,
		},
	],
	ws: [{ name: 'ws', port: 0 }],
}
