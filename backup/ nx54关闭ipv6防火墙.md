
新华三nx54没有ipv6防火墙设置，不过可以通过`http://192.168.124.1/debug.asp` 进入调试页面，然后启用telnet。

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230927/2023-09-27-21.14.34-192.168.124.1-e6823d256a8c.m8j1nfzykf4.webp)

cmd输入`telnet 192.168.124.1 15000` 登录路由器

然后输入用户名以及密码，再输入`debugshell` 

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230927/屏幕截图(38).1u882feaqvog.png)

依次输入

```
ip6tables -F
ip6tables -X
ip6tables -I INPUT -j ACCEPT
ip6tables -I FORWARD -j ACCEPT
ip6tables -I OUTPUT -j ACCEPT
```

便关闭了ipv6防火墙，路由器重启后需要重新操作
