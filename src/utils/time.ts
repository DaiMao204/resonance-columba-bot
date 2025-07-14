//计算两个时间之间的时间差 多少天时分秒
export function intervalTime(startTime: number) {
    // var timestamp=new Date().getTime(); //计算当前时间戳
    var timestamp = Date.now() / 1000;//计算当前时间戳 (毫秒级)
    var date1 = startTime; //开始时间
    var date2 = timestamp; //结束时间
    // var date3 = date2.getTime() - date1.getTime(); //时间差的毫秒数
    var date3 =  (date2 - date1)*1000; //时间差的毫秒数
    //计算出相差天数
    var days = Math.floor(date3 / (24 * 3600 * 1000));
    //计算出小时数
  
    var leave1 = date3 % (24 * 3600 * 1000); //计算天数后剩余的毫秒数
    var hours = Math.floor(leave1 / (3600 * 1000));
    //计算相差分钟数
    var leave2 = leave1 % (3600 * 1000); //计算小时数后剩余的毫秒数
    var minutes = Math.floor(leave2 / (60 * 1000));
  
    //计算相差秒数
  
    var leave3 = leave2 % (60 * 1000); //计算分钟数后剩余的毫秒数
    var seconds = Math.round(leave3 / 1000);
    //console.log(days + "天 " + hours + "小时 ")
    var time = ""
    if (days != 0){
      time = time + days + "天"
    }
    if (hours != 0){
      time = time + hours + "时"
    }
  
    return time + minutes + "分" + seconds + "秒"
    //return   days + "天 " + hours + "小时 "
  }