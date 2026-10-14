import React from 'react';
import type { CampaignContent } from '../../types/campaignCms';
import { getContributionTiers } from '../../data/contributionTiers';

interface WhereYourMoneyGoesProps {
  content?: CampaignContent;
  campaignId?: string;
  category?: string;
  materials?: AllocationMaterial[];
}

export interface AllocationMaterial {
  name: string;
  requiredQty: number;
  price: number;
}

export const ALLOCATION_REQUIRED_QTY = [1000, 1500, 1200, 1500] as const;

export function allocationMaterialsFromProducts(
  products: readonly { name: string; unitPrice: number }[],
): AllocationMaterial[] {
  return products.slice(0, ALLOCATION_REQUIRED_QTY.length).map((product, index) => ({
    name: product.name,
    requiredQty: ALLOCATION_REQUIRED_QTY[index] ?? ALLOCATION_REQUIRED_QTY[ALLOCATION_REQUIRED_QTY.length - 1],
    price: product.unitPrice,
  }));
}

export const WhereYourMoneyGoes: React.FC<WhereYourMoneyGoesProps> = ({ content, campaignId, category, materials }) => {
  const rows = getContributionTiers(campaignId, category);
  const headingId = React.useId();
  const hasMaterials = Boolean(materials?.length);
  return (
    <section id="where-money-goes" className="py-4 sm:py-7 bg-[#F4F7FA] border-b border-slate-200/80">
      <div className="max-w-2xl mx-auto px-3.5 sm:px-6">
        
        {/* Outer Matte Light Orange Container */}
        <div className="bg-[#FFF0E6] border-2 border-[#FF6B00] rounded-2xl sm:rounded-3xl shadow-md overflow-hidden p-2 sm:p-3">
          
          {/* Main Title Banner */}
          <div className="text-center py-3.5 sm:py-4 px-4">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#FF6B00] bg-white px-3 py-1 rounded-full inline-block mb-1.5 border border-[#FF6B00]/30 shadow-2xs">
              {content?.allocation_eyebrow || 'Transparency & Allocation'}
            </span>
            <h2 id={headingId} className="font-display font-black text-[#A82512] text-base sm:text-xl tracking-wide uppercase">
              {hasMaterials ? 'Where Your Money Goes?' : (content?.allocation_title || 'Where Your Money Goes?')}
            </h2>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-[#FF6B00]/30 shadow-inner">
            <table aria-labelledby={headingId} className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-[#FF6B00] text-white text-xs sm:text-sm font-bold">
                  <th scope="col" className="py-2 sm:py-2.5 px-2 sm:px-5 text-left border-r border-white/20 w-2/5 sm:w-1/2 break-words">
                    {hasMaterials ? 'Material' : 'Contribution'}
                  </th>
                  <th scope="col" className="py-2 sm:py-2.5 px-2 sm:px-5 text-center break-words">
                    {hasMaterials ? 'Required Qty' : 'Purpose'}
                  </th>
                  {hasMaterials && (
                    <th scope="col" className="py-2 sm:py-2.5 px-2 sm:px-5 text-right w-1/4 break-words">
                      Price/Unit
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-slab">
                {(hasMaterials ? materials : rows).map((row, index) => (
                  <tr 
                    key={hasMaterials ? row.name : row.amount}
                    className={index % 2 === 0 ? 'bg-orange-50/40 hover:bg-orange-50' : 'bg-white hover:bg-orange-50/50'}
                  >
                    <td className="py-2 sm:py-2.5 px-2 sm:px-5 text-left font-black text-[#FF6B00] text-xs sm:text-sm border-r border-slate-100 break-words">
                      {hasMaterials ? row.name : row.amount}
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-5 text-center font-semibold text-slate-800 text-xs sm:text-sm break-words tabular-nums">
                      {hasMaterials ? row.requiredQty.toLocaleString('en-IN') : row.purpose}
                    </td>
                    {hasMaterials && (
                      <td className="py-2 sm:py-2.5 px-2 sm:px-5 text-right font-black text-[#FF6B00] text-xs sm:text-sm break-words tabular-nums">
                        ₹{row.price.toLocaleString('en-IN')}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </section>
  );
};
