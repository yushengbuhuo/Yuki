# 庄园模型与 Q 弹动画

来源：`G:/BallsManorWeb/Assets/ThreeD/BallManorArt.blend`。使用当前 `Qball` 集合中的 `Qball.003` 和四个子网格，不使用备份集合。导出过程只操作后台副本，不保存原始 blend。

## 资源与摆放

`assets/models/manor/manifest.json` 记录源文件校验值、每个 GLB 的大小、三角形数和 Qball 部位。共 23 个 GLB，约 5.76 MB；贴图最大边 512 像素，嵌入 GLB。

| 模型 | 网页中的用途 |
| --- | --- |
| Qball | 替换小屋、庄园和独立角色展示模块的小球；身体、双眼、双脚独立 |
| Animal_Cat_01 / 02 | 两只在庄园慢慢散步的猫 |
| Animal_Dog_01 | 小屋门前附近的小狗 |
| Animal_Rabbit_01 / 02 | 草地上的两只跳跳兔 |
| Animal_Chicken_01 | 花草附近的小鸡 |
| Animal_Sloth_01 | 后方空地里慢慢活动的树懒 |
| Animal_Bird_01 | 地面上跳动的小鸟 |
| Animal_Bird_02 | 保留原有来访、观察、离开行为的小鸟 |
| Animal_Sheep_01 | 替换原有羊群，桌面 10 只、手机 7 只，共用实例化模型 |
| Manor_Rock_01 | 替换 23 块池边石头，共用一个实例化网格；网页副本减至约 768 个三角形 |
| Manor_StoneLantern_01 | 替换四盏路灯，保留原有暖光数量 |
| Manor_HandWaterPump_01 | 小屋附近的水泵，点击清洁 |
| Manor_HayBale_01 | 草地左侧的草捆 |
| Manor_LogPile_01 | 小屋旁的木柴堆 |
| Manor_Pumpkin_01 | 草捆附近两颗大小不同的南瓜 |
| Manor_Birdhouse_01 | 后方小路附近的鸟屋 |
| Manor_WoodenSignpost_01 | 小路旁的木路牌 |
| Interior_BeanbagChair_01 | 替换旧坐垫，点击休息 |
| Interior_RoundSofa_01 | 小屋里的圆沙发，点击休息 |
| Interior_FruitBowl_01 | 替换桌上的旧果碗，保留原莓果点心互动 |
| Interior_YarnBasket_01 | 坐垫旁的毛线篮，点击玩耍 |

所有物件保留颜色贴图，使用更轻的 Lambert 哑光光照，并接入现有实时阴影、六种风格、描边和辉光，避免为每盏灯计算 PBR 镜面反射。Qball 继续使用原有柔软黑色皮肤材质及独立眼睛表情。

## 动画方式

- Qball：接入原有局部顶点拉伸和抛掷求解器；增加点击、走动和呼吸时的整体压缩回弹。身体形变时眼睛随动，保持双脚结构。
- 动物：无需骨骼，使用底部为轴心的整体挤压、轻跳和左右摇摆。兔子、小鸟偏轻跳，猫狗偏摇摆；沿导航路径慢慢活动，绕开池塘、房屋、树木和新摆放的固定物件。
- 小物件：平时静止，点击时短暂弹动。羊群每只动物独立计算弹性，但共用一次实例化提交。
- 弹性采用阻尼弹簧，最多 120 Hz 子步长；纵向比例为 `s` 时，横向比例为 `1/sqrt(s)`，近似保持体积，不随帧率累积形变。
- “画面风格 → Q 弹程度”支持 0–1.5，自动保存；0 关闭额外弹性。系统开启减少动态效果时，停止这些弹跳、呼吸和动物自主走动。

目前动物是整体弹性动画，没有逐腿行走、独立耳朵或翅膀的骨骼动画。

## 代码与维护

| 文件 | 职责 |
| --- | --- |
| `assets/js/pet-assets.js` | 四路并发加载、共享资源、模型实例、Qball 部位、弹性强度 |
| `assets/js/pet-jelly.mjs` | 与帧率无关的弹性求解 |
| `assets/js/pet-residents.js` | 常驻动物的导航、活动节奏和点击互动 |
| `assets/js/pet-wildlife.js` | 原有羊群及来访小鸟接入新模型 |
| `assets/js/pet-experience.js` | Qball 拖拽、抛落与整体弹性组合 |
| `tools/export-manor-models.py` | Blender 后台导出；可传 `--only Manor_Rock_01` 重新导出单项 |

完整导出：用 Blender 以 `--factory-startup --background --disable-autoexec` 打开源 blend，再用 `--python tools/export-manor-models.py` 执行。导出脚本从自身位置确定输出目录。源文件变化后应完整导出，单项导出会检查源文件校验值。

验证：`node tools/check-jelly.mjs` 检查体积、收敛和 30/60 FPS 一致性；`node tools/check-model-integration.cjs` 检查加载、拖拽、抛落、动物回弹、风格、羊群与移动端；`node tools/compare-model-performance.cjs` 在相同设置下与修改前来源进行对比。浏览器验证使用本机 Playwright，预览地址为 `http://127.0.0.1:8767/pet.html`。

截图与报告保存到 `G:/BallsManorWeb/Art/ModelIntegration/`。性能对比属于这台机器的本地浏览器结果，不能代表其他设备。
