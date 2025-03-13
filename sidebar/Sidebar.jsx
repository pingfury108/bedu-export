import React, { useState, useEffect } from "react";

export default function Main() {
  const [startDate, setStartDate] = useState("2025-03-06");
  const [endDate, setEndDate] = useState("2025-03-13");
  const [supplierId, setSupplierId] = useState("syr");
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState("settings");
  const [productTypeId, setProductTypeId] = useState("fixed");
  const [supplierOptions, setSupplierOptions] = useState([
    { id: "syr", name: "syr" },
    { id: "abc", name: "ABC Supplier" },
    { id: "xyz", name: "XYZ Supplier" },
  ]);
  const [productTypes, setProductTypes] = useState([
    { id: "fixed", name: "定产容案" },
    { id: "custom", name: "定制产品" },
    { id: "standard", name: "标准产品" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [port, setPort] = useState(null);

  // Establish connection with background script
  useEffect(() => {
    const newPort = chrome.runtime.connect({ name: "sidebar" });
    setPort(newPort);

    // Listen for messages from background script
    newPort.onMessage.addListener((message) => {
      console.log('Sidebar received message:', message);
      
      if (message.action === 'filterDataResponse') {
        setIsLoading(false);
        setPendingMessage(null);
        
        if (message.error) {
          setError(message.error);
        } else if (message.data && message.data.errno === 0) {
          // Process the filter data
          const filterData = message.data.data.filter;
          
          // Update supplier options
          const supplierFilter = filterData.find(filter => filter.id === 'sid');
          if (supplierFilter && supplierFilter.list) {
            setSupplierOptions(supplierFilter.list.map(item => ({
              id: item.id,
              name: item.name
            })));
            
            // Set default supplier ID to the first one in the list if available
            if (supplierFilter.list.length > 0) {
              setSupplierId(supplierFilter.list[0].id.toString());
            }
          }
          
          // Update product types
          const clueTypeFilter = filterData.find(filter => filter.id === 'clueType');
          if (clueTypeFilter && clueTypeFilter.list) {
            setProductTypes(clueTypeFilter.list.map(item => ({
              id: item.id,
              name: item.name
            })));
          }
        }
      } else if (message.action === 'error') {
        setIsLoading(false);
        setPendingMessage(null);
        setError(message.error);
      } else if (message.action === 'requestPending') {
        setIsLoading(true);
        setError(null);
        setPendingMessage(message.message);
      } else if (message.action === 'contentScriptReady') {
        // Content script is ready, we can fetch data if not already loading
        if (!isLoading) {
          fetchFilterData();
        }
      }
    });

    // Handle disconnection
    newPort.onDisconnect.addListener(() => {
      console.log('Disconnected from background script');
      setPort(null);
      setError('与后台脚本的连接已断开。请刷新页面重试。');
    });

    // Immediately try to fetch data when sidebar loads
    setIsLoading(true);
    setError(null);
    setPendingMessage(null);
    console.log('Sidebar is requesting filter data on initial load');
    newPort.postMessage({ action: 'fetchFilterData' });

    // Clean up connection when component unmounts
    return () => {
      newPort.disconnect();
    };
  }, []);

  // Function to fetch filter data
  const fetchFilterData = () => {
    if (port) {
      setIsLoading(true);
      setError(null);
      setPendingMessage(null);
      console.log('Sidebar is requesting filter data');
      port.postMessage({ action: 'fetchFilterData' });
    } else {
      console.error('Cannot fetch data: port is not connected');
      setError('连接未建立，无法获取数据');
    }
  };

  // Reset form values
  const handleReset = () => {
    setStartDate("2025-03-06");
    setEndDate("2025-03-13");
    setSupplierId("syr");
    setUsername("");
  };

  // Export data
  const handleExport = () => {
    // Implement export functionality
    console.log("Exporting data with filters:", {
      startDate,
      endDate,
      supplierId,
      username,
      productTypeId
    });
  };

  // Retry fetching data
  const handleRetry = () => {
    fetchFilterData();
  };

  return (
    <div className="container max-auto px-1 mt-1">
      {activeTab === 'settings' && (
        <div className="w-full mt-2">
          <div className="flex flex-col gap-3">
            {/* Date Range Selection */}
            <div className="flex flex-col w-full">
              <label className="label label-text text-sm py-1">
                日期范围
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  className="input input-sm input-bordered w-full text-sm" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-center text-sm">至</span>
                <input 
                  type="date" 
                  className="input input-sm input-bordered w-full text-sm" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            {/* Supplier ID Dropdown */}
            <div className="flex flex-col w-full">
              <label className="label label-text text-sm py-1">
                供应商ID
              </label>
              <select 
                className="select select-sm select-bordered w-full text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={isLoading}
              >
                {supplierOptions.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Username Input */}
            <div className="flex flex-col w-full">
              <label className="label label-text text-sm py-1">
                用户名
              </label>
              <input 
                type="text" 
                placeholder="请输入" 
                className="input input-sm input-bordered w-full text-sm" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {/* Product Type Selection */}
            <div className="flex flex-col w-full">
              <label className="label label-text text-sm py-1">
                线索类型
              </label>
              <select 
                className="select select-sm select-bordered w-full text-sm"
                value={productTypeId}
                onChange={(e) => setProductTypeId(e.target.value)}
                disabled={isLoading}
              >
                {productTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Pending message */}
            {pendingMessage && (
              <div className="text-warning text-sm flex items-center">
                <span className="loading loading-spinner loading-xs mr-2"></span>
                {pendingMessage}
              </div>
            )}
            
            {/* Error message with retry button */}
            {error && (
              <div className="text-error text-sm flex items-center justify-between">
                <span>错误: {error}</span>
                <button 
                  className="btn btn-xs btn-error"
                  onClick={handleRetry}
                >
                  重试
                </button>
              </div>
            )}
            
            {/* Loading indicator */}
            {isLoading && !pendingMessage && (
              <div className="text-info text-sm flex items-center">
                <span className="loading loading-spinner loading-xs mr-2"></span>
                加载中...
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-1">
              <button 
                className="btn btn-sm btn-outline flex-1 text-sm"
                onClick={handleReset}
                disabled={isLoading}
              >
                重置
              </button>
              <button 
                className="btn btn-sm btn-primary flex-1 text-sm"
                onClick={handleExport}
                disabled={isLoading}
              >
                导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
