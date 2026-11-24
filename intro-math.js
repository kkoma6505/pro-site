(function(){
  if(!window.katex)return;
  document.querySelectorAll('[data-latex]').forEach(element=>{
    try{
      window.katex.render(element.dataset.latex,element,{
        displayMode:element.hasAttribute('data-display-math'),
        output:'htmlAndMathml',
        throwOnError:true,
        strict:'error',
        trust:false
      });
      element.dataset.mathRendered='true';
    }catch(error){
      // Retain the readable fallback if a formula cannot be rendered.
      console.error('수식을 렌더링하지 못했습니다.',error);
    }
  });
})();
