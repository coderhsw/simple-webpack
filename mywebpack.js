//导入包
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

// 第一步 转换代码 生成依赖
function stepOne(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    const ast = parser.parse(content, {
        sourceType: 'module',
    });

    const dependencies = {};
    // 遍历ast抽象语法树
    traverse(ast, {
        // 获取通过import引入的模块
        ImportDeclaration({ node }) {
            const dirname = path.dirname(filename);
            const newFile = './' + path.join(dirname, node.source.value) + '.js';
            //保存所依赖的模块
            dependencies[node.source.value] = newFile;
        },
    });

    // 通过 @babel/core 和 @babel/preset-env 进行代码的转换
    const { code } = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env'],
    });

    return {
        filename, //该文件名
        dependencies, //该文件所依赖的模块集合(键值对存储)
        code, //转换后的代码
    };
}

// 第二部 生成依赖图谱
function stepTwo(entry) {
    const entryModule = stepOne(entry);

    // 图谱数组
    const graphArray = [entryModule];

    // 关键代码，获取入口模块及其所有相关的模块，放到图谱数组中
    for (let i = 0; i < graphArray.length; i++) {
        const module = graphArray[i];
        const { dependencies } = module;

        for (let j in dependencies) {
            graphArray.push(stepOne(dependencies[j]));
        }
    }

    // 生成图谱
    const graph = {};
    for (let i = 0; i < graphArray.length; i++) {
        const item = graphArray[i];

        graph[item.filename] = {
            dependencies: item.dependencies,
            code: item.code,
        };
    }

    return graph;
}

// 生成代码字符串
function stepThree(entry) {
    const graph = JSON.stringify(stepTwo(entry));

    return `
	(function(graph) {
		//require函数的本质是执行一个模块的代码，然后将相应变量挂载到exports对象上
		function require(module) {
			//localRequire的本质是拿到依赖包的exports变量
			function localRequire(relativePath) {
				return require(graph[module].dependencies[relativePath]);
			}
			var exports = {};
			(function(require, exports, code) {
				eval(code);
			})(localRequire, exports, graph[module].code);
			return exports;//函数返回指向局部变量，形成闭包，exports变量在函数执行后不会被摧毁
		}
		require('${entry}')
	})(${graph})
	`;
}

const code = stepThree('./src/index.js');
console.log(code)
