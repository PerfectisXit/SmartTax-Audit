import { DiningPlan, ExtractedInvoiceData } from "../types";

export const generateWordDoc = async (data: ExtractedInvoiceData, plan: DiningPlan) => {
  // Parse date for the form
  const [year, month, day] = plan.applicationDate.split('-');

  // Create an HTML structure that mimics the Word table provided in the template
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>招待费用申请单</title>
      <style>
        body { font-family: 'Songti SC', 'SimSun', serif; }
        .title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .subtitle { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; text-decoration: underline; }
        .dept { font-size: 14px; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; border: 2px solid black; }
        td { border: 1px solid black; padding: 10px; font-size: 14px; vertical-align: middle; }
        .label { font-weight: bold; text-align: center; width: 15%; background-color: #f0f0f0; }
        .content { width: 35%; }
        .checkbox-group { display: flex; gap: 15px; }
        .footer { margin-top: 20px; display: flex; justify-content: space-between; padding: 0 50px; }
        .note { font-size: 12px; margin-top: 15px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="title">南京中交建设发展有限公司</div>
      <div class="subtitle">招待费用申请单</div>
      
      <div class="dept">申请部门：招商运营部</div>
      
      <table>
        <tr>
          <td class="label">接待单位</td>
          <td class="content"></td>
          <td class="label">申请日期</td>
          <td class="content">${year} 年 ${month} 月 ${day} 日</td>
        </tr>
        <tr>
          <td class="label">招待人数</td>
          <td class="content">${plan.guestCount} (客户) + ${plan.staffCount} (陪同) = ${plan.totalPeople}</td>
          <td class="label">陪同人数</td>
          <td class="content">${plan.staffCount}</td>
        </tr>
        <tr>
          <td class="label">接待事由</td>
          <td colspan="3">业务招待</td>
        </tr>
        <tr>
          <td class="label">预计费用</td>
          <td colspan="3">${plan.estimatedAmount} 元 (发票实销: ${data.totalAmount}元)</td>
        </tr>
        <tr>
          <td class="label">接待类型</td>
          <td colspan="3">
            ☑商务招待 &nbsp;&nbsp; □外事招待 &nbsp;&nbsp; □其他公务招待
          </td>
        </tr>
        <tr>
          <td class="label">接待方式</td>
          <td colspan="3">
            ☑宴请就餐 &nbsp;&nbsp; □酒店住宿 &nbsp;&nbsp; □购纪念品 &nbsp;&nbsp; □其他
          </td>
        </tr>
        <tr>
          <td class="label">接待标准</td>
          <td colspan="3">
            每次人均标准不超过: ☑150 元 &nbsp; □200 元 &nbsp; □250 元 &nbsp; □300 元
          </td>
        </tr>
        <tr style="height: 80px;">
          <td class="label">审 批<br/>签 字</td>
          <td colspan="3" style="position: relative;">
            <div style="display: flex; justify-content: space-between; padding: 0 20px; margin-top: 20px;">
              <span>总经理：</span>
              <span>申请人：</span>
            </div>
          </td>
        </tr>
      </table>

      <div class="note">
        <strong>注：</strong>商务和外事招待时，招待对象 5 人（含）以内的，陪餐人数可对等；招待对象超过 5 人的，超过部分陪餐人数原则上不超过招待对象的二分之一。其他公务招待，招待对象在 10 人以内的，陪餐人数不得超过 3 人；超过 10 人的，不得超过接待对象人数的三分之一。
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: "application/msword" });
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `业务招待费申请单_${data.invoiceDate}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};