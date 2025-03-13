import React, { useState, useEffect } from "react";

// Import SheetJS
import * as XLSX from 'xlsx';

export default function Main() {
  const [startDate, setStartDate] = useState("2025-03-06");
  const [endDate, setEndDate] = useState("2025-03-13");
  const [supplierId, setSupplierId] = useState("29");
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState("settings");
  const [productTypeId, setProductTypeId] = useState("1");
  const [supplierOptions, setSupplierOptions] = useState([
    { id: "1", name: "百度教育" },
    { id: "4", name: "高等教育-百度众测" },
    { id: "26", name: "众测-教辅拆解" },
    { id: "29", name: "syr" },
  ]);
  const [productTypes, setProductTypes] = useState([
    { id: "1", name: "定产答案" },
    { id: "2", name: "定产解析" },
    { id: "3", name: "定产视频" },
    { id: "4", name: "高等教育答案定产" },
    { id: "5", name: "高等教育错误试题修订" },
    { id: "8", name: "定向生产" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [port, setPort] = useState(null);
  // Add state variables for query results
  const [queryResults, setQueryResults] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [collectedData, setCollectedData] = useState([]);

  // Function to establish connection with background script
  const connectToBackground = () => {
    if (isConnecting) return; // Prevent multiple connection attempts
    
    setIsConnecting(true);
    console.log('Sidebar is connecting to background script...');
    
    try {
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
                id: item.id.toString(),
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
                id: item.id.toString(),
                name: item.name
              })));
              
              // Set default product type ID to the first one in the list if available
              if (clueTypeFilter.list.length > 0) {
                setProductTypeId(clueTypeFilter.list[0].id.toString());
              }
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
        } else if (message.action === 'produceUserListResponse') {
          // Handle the response from get_produceuserlist
          setIsLoading(false);
          setPendingMessage(null);
          
          if (message.error) {
            setError(message.error);
          } else if (message.data && message.data.errno === 0) {
            // Process the user list data
            const userData = message.data.data;
            setQueryResults(userData.list || []);
            setTotalCount(userData.total || 0);
            
            // Calculate page count based on total and items per page
            const pages = Math.ceil((userData.total || 0) / itemsPerPage);
            setPageCount(pages);
          }
        }
      });

      // Handle disconnection
      newPort.onDisconnect.addListener(() => {
        console.log('Disconnected from background script');
        setPort(null);
        setIsConnecting(false);
        setError('与后台脚本的连接已断开。正在尝试重新连接...');
        
        // Increment connection attempts
        setConnectionAttempts(prev => prev + 1);
        
        // Try to reconnect after a delay, with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000); // Max 30 seconds
        console.log(`Will attempt to reconnect in ${delay/1000} seconds...`);
        
        setTimeout(() => {
          connectToBackground();
        }, delay);
      });

      // Connection successful, reset connection attempts
      setConnectionAttempts(0);
      setIsConnecting(false);
      setError(null);
      
      // Immediately try to fetch data when connection is established
      console.log('Sidebar is requesting filter data on connection');
      newPort.postMessage({ action: 'fetchFilterData' });
      
    } catch (error) {
      console.error('Error connecting to background script:', error);
      setPort(null);
      setIsConnecting(false);
      setError(`连接错误: ${error.message}`);
      
      // Try to reconnect after a delay
      setTimeout(() => {
        connectToBackground();
      }, 2000);
    }
  };

  // Establish connection with background script on component mount
  useEffect(() => {
    connectToBackground();
    
    // Clean up connection when component unmounts
    return () => {
      if (port) {
        port.disconnect();
      }
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
      
      // Try to reconnect
      connectToBackground();
    }
  };

  // Function to query user list data
  const handleQuery = () => {
    if (port) {
      setIsLoading(true);
      setError(null);
      setPendingMessage('正在查询数据，请稍候...');
      
      // Format dates to match the API format (YYYYMMDD)
      const formattedStartDate = startDate.replace(/-/g, '');
      const formattedEndDate = endDate.replace(/-/g, '');
      
      // Prepare query parameters
      const params = {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        userName: username,
        clueType: parseInt(productTypeId),
        sid: parseInt(supplierId),
        pn: currentPage,
        rn: itemsPerPage
      };
      
      console.log('Sidebar is requesting produce user list with params:', params);
      port.postMessage({ 
        action: 'fetchProduceUserList',
        params: params
      });
    } else {
      console.error('Cannot fetch data: port is not connected');
      setError('连接未建立，无法获取数据');
      
      // Try to reconnect
      connectToBackground();
    }
  };

  // Reset form values
  const handleReset = () => {
    setStartDate("2025-03-06");
    setEndDate("2025-03-13");
    setSupplierId("29");
    setUsername("");
    setQueryResults(null);
    setTotalCount(0);
    setPageCount(0);
    setCurrentPage(1);
  };

  // Export data
  const handleExport = async () => {
    if (!queryResults || totalCount === 0) {
      setError('没有数据可导出');
      return;
    }

    try {
      setIsExporting(true);
      setExportStatus('正在收集数据...');
      setExportProgress(0);
      setCollectedData([]);

      // Calculate total pages needed
      const totalPages = Math.ceil(totalCount / itemsPerPage);
      let allData = [];

      // Format dates to match the API format (YYYYMMDD)
      const formattedStartDate = startDate.replace(/-/g, '');
      const formattedEndDate = endDate.replace(/-/g, '');

      // Create a promise-based version of port.postMessage that returns a promise
      const sendMessageAsync = (message) => {
        return new Promise((resolve, reject) => {
          // Set up a one-time message listener for this specific request
          const messageListener = (response) => {
            if (response.action === 'produceUserListResponse') {
              port.onMessage.removeListener(messageListener);
              if (response.error) {
                reject(response.error);
              } else if (response.data && response.data.errno === 0) {
                resolve(response.data.data);
              } else {
                reject('未知错误');
              }
            }
          };

          port.onMessage.addListener(messageListener);
          
          // Send the message
          port.postMessage(message);
          
          // Set a timeout to prevent hanging
          setTimeout(() => {
            port.onMessage.removeListener(messageListener);
            reject('请求超时');
          }, 30000); // 30 seconds timeout
        });
      };

      // Collect data from all pages
      for (let page = 1; page <= totalPages; page++) {
        setExportStatus(`正在收集数据 (${page}/${totalPages})...`);
        
        // Prepare query parameters
        const params = {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          userName: username,
          clueType: parseInt(productTypeId),
          sid: parseInt(supplierId),
          pn: page,
          rn: itemsPerPage
        };
        
        try {
          // Request data for this page
          const pageData = await sendMessageAsync({
            action: 'fetchProduceUserList',
            params: params
          });
          
          // Add the list data to our collection
          if (pageData && pageData.list && pageData.list.length > 0) {
            allData = [...allData, ...pageData.list];
          }
          
          // Update progress
          setExportProgress(Math.floor((page / totalPages) * 50)); // First 50% for data collection
        } catch (error) {
          console.error(`Error fetching page ${page}:`, error);
          setError(`获取第 ${page} 页数据时出错: ${error}`);
          setIsExporting(false);
          return;
        }
      }

      // Store the collected data
      setCollectedData(allData);
      
      // Save to Chrome storage
      setExportStatus('正在保存数据到浏览器存储...');
      
      // Use chrome.storage.local to save the data
      chrome.storage.local.set({ 'exportedData': allData }, () => {
        if (chrome.runtime.lastError) {
          setError(`保存数据时出错: ${chrome.runtime.lastError.message}`);
          setIsExporting(false);
          return;
        }
        
        // Start exporting to Excel
        setExportStatus('正在生成Excel文件...');
        setExportProgress(60); // 60% progress after storage
        
        // Define column headers mapping based on the image
        const columnHeaders = {
          userName: '用户名',
          totalLeadsClue: '线索领取数量',
          totalSubClue: '试题提交审核总数(快照)',
          totalPassClue: '试题通过总数(实时)',
          totalPassClueSnapShot: '试题通过总数(快照)',
          totalPassRate: '供应商生产通过率',
          totalPending: '驳回待生产试题数(实时)',
          totalClueDiscarded: '试题废弃总数(快照)',
          discardRate: '供应商线索废弃率',
          timeSpentPerClue: '单题平均生产耗时'
        };
        
        // Transform data to include proper headers
        const formattedData = allData.map(item => {
          const formattedItem = {};
          
          // Map each field to its corresponding header
          Object.keys(columnHeaders).forEach(key => {
            if (key in item) {
              formattedItem[columnHeaders[key]] = item[key];
            }
          });
          
          return formattedItem;
        });
        
        // Create workbook with formatted data
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(formattedData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "数据导出");
        
        setExportProgress(80); // 80% progress after creating workbook
        
        // Generate Excel file
        setExportStatus('正在下载Excel文件...');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Create download link and trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Create filename with current date and supplier name
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const supplierName = supplierOptions.find(s => s.id === supplierId)?.name || '';
        link.download = `${supplierName}_数据导出_${dateStr}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setExportProgress(100); // 100% progress after download
        setExportStatus('导出完成!');
        
        // Reset export state after a delay
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(0);
          setExportStatus('');
        }, 3000);
      });
      
    } catch (error) {
      console.error('Export error:', error);
      setError(`导出错误: ${error.message || error}`);
      setIsExporting(false);
    }
  };

  // Retry fetching data
  const handleRetry = () => {
    // First try to reconnect if port is null
    if (!port) {
      connectToBackground();
    } else {
      fetchFilterData();
    }
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
            
            {/* Results display area */}
            {queryResults && (
              <div className="mt-2 p-2 bg-base-200 rounded-md">
                <div className="text-sm font-medium">查询结果</div>
                <div className="flex justify-between text-xs mt-1">
                  <span>总数: {totalCount}</span>
                  <span>页数: {currentPage}/{pageCount}</span>
                  <span>每页: {itemsPerPage}条</span>
                </div>
              </div>
            )}
            
            {/* Export Progress */}
            {isExporting && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{exportStatus}</span>
                  <span>{exportProgress}%</span>
                </div>
                <progress 
                  className="progress progress-primary w-full" 
                  value={exportProgress} 
                  max="100"
                ></progress>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-1">
              <button 
                className="btn btn-sm btn-outline flex-1 text-sm"
                onClick={handleReset}
                disabled={isLoading || isExporting}
              >
                重置
              </button>
              <button 
                className="btn btn-sm btn-primary flex-1 text-sm"
                onClick={handleQuery}
                disabled={isLoading || isExporting}
              >
                查询
              </button>
              <button 
                className="btn btn-sm btn-accent flex-1 text-sm"
                onClick={handleExport}
                disabled={isLoading || isExporting || !queryResults}
              >
                {isExporting ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : '导出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
