export const lazyLoad = {
  mounted(el, binding) {
    const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmN2ZhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgbnNzYW5zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2MwYzRjYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4='
    
    const options = binding.value && typeof binding.value === 'object' 
      ? binding.value 
      : { src: binding.value }
    
    const {
      src,
      placeholder = defaultPlaceholder,
      errorImage = defaultPlaceholder,
      rootMargin = '50px',
      threshold = 0.01
    } = options
    
    el.setAttribute('data-src', src)
    el.src = placeholder
    
    el.style.transition = 'opacity 0.3s ease'
    el.style.opacity = '0'
    
    const setImageSrc = () => {
      el.style.opacity = '1'
      el.src = src
    }
    
    const setErrorImage = () => {
      el.src = errorImage
      el.style.opacity = '1'
      el.classList.add('lazy-load-error')
    }
    
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = new Image()
            img.src = src
            
            img.onload = () => {
              setImageSrc()
              obs.unobserve(el)
            }
            
            img.onerror = () => {
              setErrorImage()
              obs.unobserve(el)
            }
            
            img.decode().catch(() => {})
          }
        })
      }, {
        rootMargin,
        threshold
      })
      
      observer.observe(el)
      
      el._lazyObserver = observer
    } else {
      setImageSrc()
    }
  },
  
  updated(el, binding) {
    if (binding.oldValue !== binding.value) {
      const options = binding.value && typeof binding.value === 'object' 
        ? binding.value 
        : { src: binding.value }
      
      if (el._lazyObserver) {
        el._lazyObserver.unobserve(el)
      }
      
      lazyLoad.mounted(el, binding)
    }
  },
  
  unmounted(el) {
    if (el._lazyObserver) {
      el._lazyObserver.unobserve(el)
      delete el._lazyObserver
    }
  }
}

export default {
  install(app) {
    app.directive('lazy-load', lazyLoad)
  }
}
