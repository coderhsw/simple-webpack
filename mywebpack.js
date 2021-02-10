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
			console.log(node);
			const dirname = path.dirname(filename);
			const newFile = './' + path.join(dirname, node.source.value);
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
	console.log('entryModule', entryModule);

	// 图谱数组
	const graphArray = [entryModule];

	// 关键代码，获取入口模块及其所有相关的模块，放到图谱数组中
	for (let i = 0; i < graphArray.length; i++) {
		const module = graphArray[i];
		const { dependencies } = module;

		for (let j in dependencies) {
			graphArray.push(dependencies[j]);
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

//测试一下
console.log('graph', stepTwo('./src/index.js'));
