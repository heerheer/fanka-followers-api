import { Hono } from 'hono'
import { load } from 'cheerio'
import { WorkerEntrypoint } from 'cloudflare:workers';
import moment from 'moment-timezone';

type Env = {
  // If you set another name in wrangler.toml as the value for 'binding',
  // replace "DB" with the variable name you defined.
  DB: D1Database;
  USERS: string;

}

const app = new Hono<{ Bindings: Env }>()


const getData = async (user?: string) => {

  if (!user) {
    user = 'finka-OWg-Z-hXHgg'
  }
  const url = `https://www.finkapp.cn/user/${user}`
  const resp = await fetch(url)
  const html = await resp.text()


  const $ = load(html)
  const node = $('.userinfo-title')
  const p = node.children()
  console.log(p.html())
  const name = p.children().first().text()
  const followers = Number(p.children().last().text().replace('关注', ''))

  return {
    name,
    followers,
  }

}

const record = async (db: D1Database, user?: string,) => {
  if (!user) {
    user = 'finka-OWg-Z-hXHgg'
  }
  const data = await getData(user)


  moment.locale('Asia/Shanghai')
  const time = moment()


  const result = await db.prepare(
    `INSERT INTO followers_records (user, followers,time) VALUES (?, ?,?)`
  ).bind(user, data.followers, time.tz('Asia/Shanghai').format()).run()
  return result
}



app.put('/record/:user?', async (c) => {
  let { user } = c.req.param()

  return c.json({ message: '翻卡搜索「织田信短」感谢关注喵~', ...await record(c.env.DB, user) })
})

/** 获取指定时间范围内的用户粉丝数据 */
/**
 * api: /record/:user?
 * query: start, end  
 * return: {id, followers, time}[]
 * 
 * example: /record/finka-OWg-Z-hXHgg?start=2022-01-01&end=2022-01-31
 * or /record/finka-OWg-Z-hXHgg?start=2022-01-01T00:00:00
 */
app.get('/record/:user?', async (c) => {

  moment.locale('Asia/Shanghai')


  let { user } = c.req.param()
  const { start, end } = c.req.query();

  if (!user) {
    user = 'finka-OWg-Z-hXHgg'
  }

  let query = ''
  if (start) {
    let start_date = moment(start)
    let end_date = moment(end ?? '')

    if (start_date.isValid()) {
      if (!end_date.isValid())
        end_date = moment()
      query = `SELECT id,followers,time FROM followers_records WHERE user = ? AND DATETIME(time) BETWEEN DATETIME(?) AND DATETIME(?) AND followers > 0`
      const result = await c.env.DB.prepare(
        query
      ).bind(user, start_date.toISOString(true), end_date.toISOString(true)).run()
      console.log(start_date.toISOString(true), end_date.toISOString(true))
      return c.json({ message: '翻卡搜索「织田信短」感谢关注喵~', ...result })
    } else {
      return c.json({ message: 'invalid date format', success: false })
    }
  }
  query = `SELECT id, followers, time 
         FROM followers_records 
         WHERE user = ? 
           AND followers > 0 
           AND DATE(time) = DATE('now')`


  const result = await c.env.DB.prepare(
    query
  ).bind(user,).run()
  return c.json({ message: '翻卡搜索「织田信短」感谢关注喵~', ...result })
})

app.get('/user', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT DISTINCT user FROM followers_records`
  ).run()
  return c.json({ message: '翻卡搜索「织田信短」感谢关注喵~', ...result })
})

app.get('/users', (c) => {
  // 读取环境变量 users
  const usersEnv = c.env.USERS;

  // 检查环境变量是否存在
  if (!usersEnv) {
    return c.json({ error: 'Environment variable "users" not found' }, 404);
  }

  // 通过逗号分隔字符串
  const usersList = usersEnv.split(',');

  // 返回JSON响应
  return c.json(usersList);
});
app.get('/:user?', async (c) => {
  let { user } = c.req.param()
  const data = await getData(user)
  return c.json({ message: '翻卡搜索「织田信短」感谢关注喵~', ...data })
})




const scheduled = async (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
  //ctx.waitUntil(record(env.DB, 'finka-OWg-Z-hXHgg')) // 大饼
  //ctx.waitUntil(record(env.DB, 'finka-d4eSl3BHocw')) // 杰宝
  //ctx.waitUntil(record(env.DB, 'finka-gotSSGOhlsU')) // 兜兜
  for(const user of env.USERS.split(',')) {
    ctx.waitUntil(record(env.DB, user))
  }
}

export default {
  fetch: app.fetch,
  scheduled
}  
