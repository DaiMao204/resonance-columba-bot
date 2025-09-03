import { cicies_set, cityItems_set } from "./cicies";
import { products_set,products_set_new } from "./products";
import { roleSkills_set } from "./roleSkills";
import { get_price, send_error,errorNum,get_price_steam} from "..";
import { cityattachlist_default,resonanceskills_default,products_default } from "../data/data"

const https = require('https');
const vm = require('vm');

export async function updata_columba_data (ctx,startUrl = "", flag = false){
    cicies_set(cityattachlist_default)
    roleSkills_set(resonanceskills_default)
    products_set_new(products_default)
    if (flag) {
        get_price();
        get_price_steam()
    }
    cityItems_set()

    /*
    const result = await ctx.http("https://unpkg.com/resonance-data-columba/dist/columbabuild.js", {redirect: 'manual'})
    //console.log(result.headers.get('location'))

    if (errorNum != 0){
        var loca = result.headers.get('location')
        //console.log(loca)
        let locaNum = loca.match(/\d+(\.\d+)?/g)
        //console.log(locaNum)
        let num = Number(locaNum[1]) - errorNum
        //console.log(num)
        loca = loca.replace(locaNum[1], String(num))
        //console.log(loca)
        var url = "https://unpkg.com" + loca

        console.log("尝试使用旧版本数据源" + " 版本号 " + locaNum[0] + "." + num)
        send_error("尝试使用旧版本数据源" + " 版本号 " + locaNum[0] + "." + num)
    }else{
        var url = "https://unpkg.com" + result.headers.get('location')
    }

    if (startUrl != "" && startUrl != undefined){
        url = startUrl
    }
    
    //console.log(url)
    try{
        https.get( url,(res) =>{
            let data = '';
            res.on('data', (chunk) => {
                data += chunk
            });
            res.on('end', () => {

                const context = {
                    exports:{},
                    module: {exports:{"FORMULAS":"","CITY_ATTACH_LIST":"","GOODS_UNLOCK_CONDITIONS":"","PRODUCTS":"","RESONANCE_SKILLS":""}}
                }
                //console.log(data)
                const script = new vm.Script(data);
                script.runInNewContext(context);
                //const formulas = context.module.exports.FORMULAS;
                const CITY_ATTACH_LIST = context.module.exports.CITY_ATTACH_LIST;
                const goodsUnlockConditions = context.module.exports.GOODS_UNLOCK_CONDITIONS;
                const ptdDatas = context.module.exports.PRODUCTS;
                const RESONANCE_SKILLS = context.module.exports.RESONANCE_SKILLS;
                //console.log(CITY_ATTACH_LIST)
                console.log(ptdDatas)    
                console.log(products_default) 
                //console.log(RESONANCE_SKILLS)    
                cicies_set(CITY_ATTACH_LIST)
                roleSkills_set(RESONANCE_SKILLS)
                products_set(products_default,goodsUnlockConditions)
                if (flag) {
                    get_price();
                }
                cityItems_set()
                console.log("数据更新完成！")
                console.log("目前数据版本", url)
            })
        }).on('error', (err) => {
            console.error('error', err)
        })
    }
    catch{
        send_error("数据更新过程出现错误，请联系管理员。")
    }*/

    
}