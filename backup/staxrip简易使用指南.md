
## 界面

点击save project as template可将当前配置保存为模板并在启动时自动应用，open video source file可导入视频![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(25).7j0psgrqoxw0.webp)    

apps栏有许多常用的压制工具

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(27).21cixk9g4bkw.webp)  

vs filter鼠标左键点击可以添加各种vs滤镜，resize可以方便调整输出分辨率，nvenc（编码栏）点击可以选择输出的编码，mkv点击可以选择视频的容器

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(26).1bitu32o9yn4.webp)

## 使用nvenc显卡加速编码

edit profiles，点击add 选择nvencc h265为模板新建配置

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(28).sr62q9hy0rk.webp)

具体参数设置可参考[VCB-Studio教程](https://vcb-s.nmm-hd.org)，以及[nvencc说明](https://github.com/rigaya/NVEnc/blob/master/NVEncC_Options.en.md)，个人使用的是vbrq。  


   
## 2025/10/1 更新  
  
因为nvenc更新了qvbr，目前使用的参数为 --avhw --qvbr 26 --codec h265 --preset p7 --output-depth 10 --profile main10 --multipass 2pass-full --qp-max 30:32:34 --qp-min 20:22:24 --aq --aq-strength 8 --bref-mode each --bframes 5 --ref 6 --lookahead 32    
  
[设置参考来源](https://blog.magicalex.top/NVEnc-options/)
  
### basic设置

mode选择qvbr，preset quality=p7，depth选择10bit；profile选择main10，level选择auto，vbr quality 一般建议设置为28及以上（越低质量越高）

![Image](https://github.com/user-attachments/assets/c0223e4b-869c-4849-baef-b673eca3bd13)


### rate control码率控制  
  
multipss选择2pass full，aq strength 设置8，max qp和min qp可以不设置，不如对码率范围有要求可以自行设置

![Image](https://github.com/user-attachments/assets/ba920a77-1f4f-4b6b-a2c1-2316e0dd2347)

### slice decision

设置b帧，nvencC最大只支持5，ref frames设置6，lookahead最大只支持32，bref mode选择each，似乎是因为bug， 启用b帧无法使用weightp

![Image](https://github.com/user-attachments/assets/c1b7b628-5b1d-44e9-b8ad-8f89508a8925)
  
### input/output  
  
decoder设置为nvenc 硬件解码
  
![Image](https://github.com/user-attachments/assets/3df7c31c-5007-45ee-a0ae-ac015549545f)

至此完成nvenc hevc设置
  
### 投名状切片对比
    

![Image](https://github.com/user-attachments/assets/618c1ce6-c6f5-469c-be80-3797755df1a9)

![Image](https://github.com/user-attachments/assets/6cf6febe-b3c9-48ba-ac50-df81783c3ee5)  
  
vmaf测试  
  
<img width="962" height="439" alt="Image" src="https://github.com/user-attachments/assets/a93b040c-c422-4a54-a2f1-eca18fe5825a" />

## vs滤镜使用

### [vapoursynth-waifu2x](https://github.com/Nlzy/vapoursynth-waifu2x-ncnn-vulkan/) 使用

```
core.w2xnvk.Waifu2x(clip[, noise, scale, model, tile_size, gpu_id, gpu_thread, precision, tile_size_w, tile_size_h, tta])
```

需先转换格式为rgb32，编辑脚本导入mvf

`import mvsfunc as mvf`  

`clip = mvf.ToRGB(clip, depth=32, matrix="601")` 

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(35).332cehpe13u0.png)

导入waifu2x插件（修改为自己的路径）

`core.std.LoadPlugin(r"F:\DATA\software\StaxRip\Apps\Plugins\VS\vsw2xnvk\vsw2xnvk.dll")`  

waifu2x设置

`clip = core.w2xnvk.Waifu2x(clip, noise=0, scale=2, model=2, tile_size=0)` 

转换为yuv格式

`clip = mvf.ToYUV(clip, matrix ="709", css ="444", depth =16)`  

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(36).1ny5fcymu3ls.png)
