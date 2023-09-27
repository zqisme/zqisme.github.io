
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

### basic设置

preset quality=p7，depth选择10bit；为了最大兼容性考虑，tier选择main，level选择4

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(31).67rukkaflu80.png)

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(30).4e956lilbj80.png)

### rate control控制码率

vbrq模式需选中constant quality mode，为追求画质与体积的平衡个人设置为q25，nvenc multipass作用于单帧，用于控制码率及提升画面。个人选择2pass full，max qp可提升最大码率个人设置25，min qp设置1；最大码率设置为7000。

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(32).2h2w2jh0ase0.webp)

### slice decision

设置b帧，nvencC最大只支持5，ref frames设置4，lookahead最大只支持32，bref mode选择each，似乎是因为bug， 启用b帧无法使用weightp

![](https://github.com/zqisme/picx-images-hosting/raw/master/20230926/屏幕截图(33).7hu2xm8f16k0.webp)

至此完成nvenc hevc设置

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
